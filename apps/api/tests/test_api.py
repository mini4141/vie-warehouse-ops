def test_healthz(client):
    assert client.get("/healthz").json() == {"ok": True}


def test_layout(client):
    body = client.get("/api/layout").json()
    assert (
        body["width"] == 60
        and len(body["racks"]) == 48
        and len(body["stations"]) == 4
        and len(body["chargers"]) == 6
    )


def test_robots_and_detail_and_command(client):
    robots = client.get("/api/robots").json()
    assert len(robots) == 200 and robots[0]["id"] == "R-001"
    assert {"taskId", "lastSeen", "heading"} <= robots[0].keys()
    detail = client.get("/api/robots/R-001").json()
    assert detail["id"] == "R-001" and "task" in detail
    idle = next(r for r in robots if r["status"] == "idle")
    paused = client.post(f"/api/robots/{idle['id']}/commands", json={"command": "pause"}).json()
    assert paused["status"] == "idle"
    assert client.post(f"/api/robots/{idle['id']}/commands", json={"command": "resume"}).status_code == 200


def test_dashboard_summary(client):
    body = client.get("/api/dashboard/summary").json()
    assert body["total"] == 200 and len(body["series"]) == 60 and set(body["byStatus"]) >= {"idle", "moving"}


def test_orders(client):
    body = client.get("/api/orders").json()
    assert len(body["items"]) >= 60 and body["counts"]["completed"] > 0
    demo = client.post("/api/orders/demo").json()
    assert demo["status"] == "queued"
    detail = client.get(f"/api/orders/{demo['id']}").json()
    assert len(detail["tasks"]) == detail["lineCount"]
    assert all(o["status"] == "completed" for o in client.get("/api/orders?status=completed").json()["items"])


def test_events_and_fault_injection(client):
    fault = client.post("/api/sim/faults").json()
    assert fault["code"] == "ROBOT_FAULT" and fault["severity"] == "error"
    events = client.get("/api/events?limit=5").json()
    assert len(events) == 5 and events[0]["id"] >= events[1]["id"]


def test_handheld_flow(client):
    for _ in range(40):  # handheld tasks are ~15 % of lines; create orders until one exists
        client.post("/api/orders/demo")
    task = client.get("/api/handheld/next-task").json()["task"]
    assert task and task["type"] == "pick" and task["sku"]
    assert client.post(f"/api/handheld/tasks/{task['id']}/issue").json() == {"ok": True}
    assert client.post(f"/api/handheld/tasks/{task['id']}/confirm").json() == {"ok": True}
    nxt = client.get("/api/handheld/next-task").json()["task"]
    assert nxt is None or nxt["id"] != task["id"]


def test_websocket_frames(client):
    with client.websocket_connect("/ws/telemetry") as ws:
        frame = ws.receive_json()
        assert frame["type"] == "robots" and len(frame["r"]) == 200 and len(frame["r"][0]) == 6
        assert ws.receive_json()["type"] in {"counts", "event"}

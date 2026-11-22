from app.seed import build_engine
from app.sim.path import route


def test_tick_advances_state():
    eng = build_engine(42, 200)
    before = {r.id: (r.x, r.y) for r in eng.robots}
    for _ in range(60):  # 12 simulated seconds
        eng.tick()
    moved = [r for r in eng.robots if (r.x, r.y) != before[r.id]]
    assert moved, "at least one robot should have moved"
    assert any(t.status == "active" for t in eng.tasks.values())


def test_seed_is_deterministic():
    a, b = build_engine(7, 50), build_engine(7, 50)
    for _ in range(25):
        a.tick()
        b.tick()
    assert [(r.x, r.y, r.status) for r in a.robots] == [(r.x, r.y, r.status) for r in b.robots]


def test_route_uses_aisles():
    pts = route((10.0, 3.5), (30.0, 22.5))
    assert pts[0] == (10.0, 7.5) and pts[-1] == (30.0, 22.5)
    assert all(abs(p[0] - q[0]) < 1e-9 or abs(p[1] - q[1]) < 1e-9 for p, q in zip(pts, pts[1:], strict=False))

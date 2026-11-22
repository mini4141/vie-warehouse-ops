# SPECS.md — Warehouse Ops Console (WOC)

End-to-end specification. Companion to `CLAUDE.md` (rules). Where they conflict, `CLAUDE.md` wins.

---

## 1. Overview

**WOC** is a control-room and handheld web app for a simulated robotic warehouse: live fleet map in 3D, fleet table, order/task tracking, event stream, and an operator handheld view for industrial Android devices.

- **Audience of the build:** a hiring team for a Frontend Engineer on a WES & Fleet Management team.
- **Goal:** show every technology and responsibility in the job post, working end to end, in one day.
- **Non-goal:** correct warehouse logic. The simulator is a believable toy.
- **Delivery:** deploy on AWS, capture screenshots and a short screen recording, destroy. A mock-mode static build (no backend) can be hosted free afterwards so the demo outlives the AWS bill.

## 2. Job-post coverage matrix

| Job-post item | Where it is demonstrated |
|---|---|
| UIs for WES and fleet mgmt, web **and** industrial Android | Control-room routes + `/handheld` PWA route (360×800, touch, keyboard-wedge scanner input); Capacitor APK = stretch |
| Reusable high-performance components, real-time data, long-running workflows | `RobotTable` (virtualized), `TwinCanvas`, `KpiTile`, `EventStream`; telemetry store fed by Web Worker; WS reconnect |
| Translate operational requirements into intuitive UX | Operator flows: monitor → select robot → pause/recall; order → drill into task timeline; handheld pick → scan → confirm |
| Integrate with backend APIs, end-to-end features | Typed client generated from OpenAPI; REST + WebSocket; mutations with optimistic update |
| Stability / responsiveness via profiling, debugging, refactoring | FPS + render-count overlay; telemetry kept out of React render path; React Profiler and DevTools Performance screenshots |
| Testing, localization, build and release pipelines | Vitest, Playwright, `i18n:check`, GitHub Actions CI, versioned Docker image + deploy script |
| Investigate and fix production issues | Fault-injection button → event stream + toast + robot turns red; CloudWatch Logs screenshot |
| React, Babylon.js, WebGL | React app + Babylon 3D digital-twin view |
| TypeScript and JavaScript | Everything in `apps/web` |
| Python proficiency | FastAPI service, async sim loop, seed scripts |
| Async programming and threading | Python `asyncio` tasks; browser Web Worker for telemetry |
| Localization and translation pipelines | `en`/`ja`, coded events with params, `Intl` formatting, key-parity CI check |
| C++ and Python addons | **Stretch:** pybind11 `pathfinder` addon with pure-Python fallback |
| Full-stack | React → FastAPI → PostgreSQL → AWS (CloudFront, S3, ALB, ECS Fargate, RDS) |
| Linux toolchain | Docker/Linux containers, Makefile, shell scripts, `uv`, `pnpm` |
| Customer-site / ops mindset | Connection-status chip, latency readout, "Live / Mock" data-source indicator |

## 3. Scope and non-goals

In scope: the 7 screens in §7, the API in §9, the sim in §10, AWS deploy in §11.

Out of scope (do **not** build): authentication/roles, input validation, pagination edge cases, multi-tenant, real robot protocols, file uploads, admin CRUD, accessibility beyond labels/focus/contrast, offline sync, error-path testing, load testing.

## 4. Architecture

```
                      ┌──────────────────────────────────────────────┐
 Browser / Android    │  CloudFront (single domain, no CORS)         │
 ───────────────────► │   /*            → S3 (OAC)  SPA + CF Function│
  React + Babylon     │   /api/*, /ws/* → ALB (http, CF-only SG)     │
  Web Worker          └───────────────┬──────────────────────────────┘
                                      │
                           ┌──────────▼──────────┐       ┌───────────────┐
                           │ ALB :80             │       │ S3 (static)   │
                           └──────────┬──────────┘       └───────────────┘
                                      │
                           ┌──────────▼──────────┐
                           │ ECS Fargate (1 task)│  FastAPI + asyncio sim
                           │ 0.5 vCPU / 1 GB     │  in public subnet, public IP
                           └──────────┬──────────┘
                                      │ asyncpg
                           ┌──────────▼──────────┐
                           │ RDS Postgres 16     │  db.t4g.micro, single-AZ,
                           │ isolated subnets    │  no internet route
                           └─────────────────────┘
```

Frontend data flow:

```
 WebSocket ─► telemetry.worker ─► Float32Array (transfer) ─► telemetryStore (mutable)
                                                              ├─► Babylon render loop (getState, every frame)
                                                              ├─► React selectors, throttled ≤2 Hz (panels, KPIs)
                                                              └─► table rows (per-row subscriptions)
 REST ─► src/api client ─► TanStack Query ─► components
 MockSource (same interface as WsSource) replaces WebSocket when VITE_DATA_SOURCE=mock
```

## 5. Tech stack

See `CLAUDE.md §3`. Versions: latest stable at build time, lockfiles committed.

## 6. Domain model

All coordinates are in meters on a 2D floor plan; the 3D scene extrudes it.

| Entity | Fields |
|---|---|
| **Robot** | `id` (`R-001`…), `kind` (`amr` \| `forklift`), `status` (`idle` \| `moving` \| `picking` \| `charging` \| `fault` \| `offline`), `battery` 0–100, `x`, `y`, `heading` (rad), `speed`, `taskId?`, `lastSeen` |
| **Order** | `id` (`O-00001`…), `customer`, `priority` (`low` \| `normal` \| `high`), `status` (`queued` \| `in_progress` \| `completed` \| `short` \| `cancelled`), `lineCount`, `linesDone`, `createdAt`, `dueAt` |
| **Task** | `id`, `orderId`, `type` (`move` \| `pick` \| `charge`), `status` (`pending` \| `active` \| `done`), `robotId?`, `from` (x,y), `to` (x,y), `sku?`, `qty?`, `locationLabel?`, `startedAt?`, `finishedAt?` |
| **Event** | `id`, `ts`, `severity` (`info` \| `warn` \| `error`), `code` (e.g. `ROBOT_FAULT`, `LOW_BATTERY`, `ORDER_DONE`), `robotId?`, `orderId?`, `params` (object) |
| **Layout** | `width`, `height`, `racks[] {x,y,w,d,h}`, `stations[] {id,x,y,kind: 'pick'\|'pack'}`, `chargers[] {id,x,y}` |
| **KpiPoint** | `ts`, `linesPerMin`, `utilization` |

Seed: 1 layout (60 m × 40 m, ~12 rack rows, 4 stations, 6 chargers), **200 robots** (default; configurable via `SIM_ROBOTS`), 60 historic orders, 40 historic events.

## 7. Frontend specification

### 7.1 App shell
- Left nav (icons + labels): Dashboard, Fleet Map, Fleet, Orders, Events, Handheld, Settings. Collapsible on small widths.
- Top bar: page title, **connection chip** (`Live · 42 ms` / `Mock` / `Reconnecting…`), language switcher (EN/日本語), theme toggle.
- Dark theme default. Themes: `dark`, `light`, `high-contrast` (handheld default: high-contrast).
- Routing: React Router; lazy-load each feature route; `/handheld` renders without the nav shell.

### 7.2 Screens

**S1 Dashboard `/`** — *data: `GET /dashboard/summary` (poll 5 s), WS events, WS robot status counts*
- 4 `KpiTile`s: Robots online / total, Fleet utilization %, Orders in progress, Lines per minute (with sparkline).
- Throughput line chart (last 60 points). Robot-status donut. "Latest events" list (last 8, live).
- Demonstrates: polling + push side by side; throttled selectors.

**S2 Fleet Map `/fleet/map`** — *data: `GET /layout` (once), telemetry store, `GET /robots/{id}`, `POST /robots/{id}/commands`*
- Babylon scene: floor grid, racks (thin instances, frozen), stations and chargers (simple meshes), 200 robots (thin instances, color by status, matrix updated per frame from the store with interpolation between 5 Hz samples).
- Camera presets: Top, Isometric, Follow-selected. Orbit/pan/zoom.
- Click-pick a robot → `RobotPanel` (right side sheet): id, kind, status badge, battery bar, speed, current task, last seen, buttons **Pause / Resume / Recall to charger** (mutation with optimistic status change; reconciled by next telemetry).
- Status filter chips toggle visibility by status (hidden robots collapse to zero-scale in the matrix buffer).
- Corner overlay `PerfHud`: FPS, robot count, React commits/sec, WS msgs/sec. This is the profiling story.
- Demonstrates: Babylon/WebGL, performance discipline, optimistic UI.

**S3 Fleet table `/fleet`** — *data: `GET /robots` (all, one call), telemetry store for live cells*
- TanStack Table + Virtual over all 200 (design for 1,000+). Columns: ID, kind, status, battery, task, x/y, last seen. Sort, text search, status filter.
- Live cells (status, battery, position) update through per-row subscriptions; the table itself does not re-render at telemetry rate.
- Row click opens the same `RobotPanel`.

**S4 Orders `/orders`** — *data: `GET /orders?status=`, `GET /orders/{id}`, `POST /orders/demo`*
- Status tabs with counts. Table: ID, customer, priority badge, progress bar (`linesDone/lineCount`), due, status.
- Row click → right drawer with order summary and a **task timeline** (vertical stepper: pending/active/done, robot link opens map selection).
- Button **"New demo order"** → mutation; new order appears via query invalidation.
- Orders list refetches every 5 s (long-running workflow feel).

**S5 Events `/events`** — *data: `GET /events?limit=200`, WS `event` messages*
- Live-appending log, newest on top. Severity filter, "pause stream" toggle, relative timestamps (`Intl.RelativeTimeFormat`).
- Message rendered via `t('events.<CODE>', params)`. Clicking an event with `robotId` jumps to the map with that robot selected.

**S6 Handheld `/handheld`** — *data: `GET /handheld/next-task`, `POST /handheld/tasks/{id}/confirm`*
- Designed for 360×800 industrial Android (e.g. Zebra-class) in a browser or PWA: no nav shell, high-contrast, 18px+ text, 48px+ targets, haptic-style pressed states.
- Card: **Location** (large, e.g. `A-07-3`), **SKU**, **Qty** (huge), station.
- A visually-hidden autofocused input captures **keyboard-wedge barcode scans** (typed characters ending with Enter). Any scan matching the SKU confirms the pick; a visible **"Simulate scan"** button does the same for the demo.
- Buttons: **Confirm pick**, **Report issue** (posts a warn event; no form). After confirm, fetch next task with a short success flash.
- `manifest.webmanifest` + icons so it is installable; `display: standalone`; viewport locked, no pull-to-refresh.

**S7 Settings `/settings`** — *data: `POST /sim/faults`*
- Language, theme, density (comfortable/compact).
- Data source indicator (Live/Mock, read-only, from env).
- **"Inject fault"** button → picks a random moving robot and faults it (drives the event stream + red robot + toast, the "investigate production issue" demo).

### 7.3 Shared components
`AppShell`, `ConnectionChip`, `KpiTile`, `StatusBadge`, `BatteryBar`, `RobotPanel`, `RobotTable`, `TwinCanvas`, `PerfHud`, `EventStream`, `OrderDrawer`, `TaskTimeline`, `ThemeToggle`, `LangSwitch`, `ErrorBoundary`, `Skeleton`.

### 7.4 States
Each data screen has a skeleton while loading and a single-line empty state. Errors are caught by the route `ErrorBoundary` with a "Reload" button. Nothing else.

### 7.5 Performance targets (verified by `PerfHud` and screenshot)
- Map: ≥ 55 FPS with 200 robots on a typical laptop; scene setup < 1.5 s.
- React commits attributable to telemetry: ≤ 2/s on Dashboard, ≤ 1/s on Map.
- Table: smooth scroll at 1,000 generated rows (Playwright perf not required; dev toggle `?rows=1000`).

### 7.6 Localization
- Namespaces by feature. Locale detection: `localStorage` → browser → `en`.
- `ja` must cover all keys (Claude-drafted translations are acceptable; flag in `DECISIONS.md` that they need native review).
- Backend events carry `code` + `params`; UI formats. Numbers/dates/relative time via `Intl`.
- `pnpm i18n:check`: fails if `en` and `ja` key sets differ or a key is unused in `src/`.
- Layout must not break under `ja` (longer/shorter strings): use `min-w-0` / truncation on table cells.

## 8. Realtime telemetry design

**Transport:** `WS /ws/telemetry`. Server pushes JSON text frames; the worker decodes.

```jsonc
// 5 Hz, compact arrays to keep frames small (200 robots ≈ 6 KB)
{ "type": "robots", "t": 1732267000123,
  "r": [ [idx, x, y, heading, battery, statusCode], ... ] }   // statusCode: 0 idle,1 moving,2 picking,3 charging,4 fault,5 offline

// on change only
{ "type": "event", "event": { "id": 812, "ts": "...", "severity": "error",
  "code": "ROBOT_FAULT", "robotId": "R-042", "params": { "reason": "motor" } } }

// every 2 s
{ "type": "counts", "online": 187, "total": 200, "byStatus": { "idle": 40, "moving": 110, ... } }
```

- Robot `idx` is the index into the array returned by `GET /robots` (stable ordering by id), so frames carry no strings.
- **Client:** `telemetry.worker.ts` owns the socket (WS runs in the worker), decodes frames, writes into a preallocated `Float32Array` (stride 5: x, y, heading, battery, status), transfers it to the main thread, and posts `event`/`counts` messages separately. Reconnect: fixed 1 s delay, unbounded retries; connection state posted to the store.
- **`TelemetrySource` interface** (`connect()`, `disconnect()`, `onFrame`, `onEvent`, `onCounts`, `onState`) with two implementations: `WsSource` (worker) and `MockSource` (client-side generator using the same sim rules, seeded). `VITE_DATA_SOURCE=mock|live` selects one.
- **Interpolation:** Babylon lerps from the previous to the current sample over 200 ms so motion looks continuous at 60 FPS.
- Latency chip: server includes `t`; client shows `Date.now() - t` smoothed.

## 9. API contract (screen-driven)

Base path `/api`. JSON. No auth. The OpenAPI document at `/api/openapi.json` is the source for generated TS types. Every endpoint exists because of the listed screen.

| Method & path | Consumed by | Response / notes |
|---|---|---|
| `GET /healthz` | ALB health check | `{ "ok": true }` (served outside `/api` prefix and also routed by CloudFront) |
| `GET /api/layout` | S2 | `Layout` |
| `GET /api/robots` | S2, S3 | `Robot[]` ordered by id (index = telemetry `idx`) |
| `GET /api/robots/{id}` | S2 panel | `Robot` + current `Task?` |
| `POST /api/robots/{id}/commands` | S2 panel | body `{ "command": "pause" \| "resume" \| "recall" }` → updated `Robot` |
| `GET /api/dashboard/summary` | S1 | `{ online, total, utilization, ordersInProgress, linesPerMin, series: KpiPoint[60], byStatus }` |
| `GET /api/orders?status=` | S4 | `{ items: Order[], counts: Record<status, number> }` (no pagination; cap 200) |
| `GET /api/orders/{id}` | S4 drawer | `Order` + `tasks: Task[]` |
| `POST /api/orders/demo` | S4 | creates one random order → `Order` |
| `GET /api/events?limit=` | S5, S1 | `Event[]` newest first |
| `GET /api/handheld/next-task` | S6 | `{ task: Task \| null }` (next active pick task) |
| `POST /api/handheld/tasks/{id}/confirm` | S6 | marks done → `{ ok: true }` |
| `POST /api/handheld/tasks/{id}/issue` | S6 | emits warn event → `{ ok: true }` |
| `POST /api/sim/faults` | S7 | faults a random moving robot → `Event` |
| `WS /ws/telemetry` | S1, S2, S3, S5 | see §8 |

Rule: if a screen needs something not above, add a row here first, then implement.

## 10. Backend specification

**Process:** one FastAPI app (`uvicorn`), one asyncio simulator task.

**Structure**
```
app/main.py        # app factory, lifespan (db init, seed, start sim), routers, /healthz, CORS * for local dev
app/db.py          # async engine/session, create_all on startup (no Alembic)
app/models.py      # SQLAlchemy models: Robot, Order, Task, Event, KpiPoint
app/schemas.py     # Pydantic response models
app/seed.py        # deterministic seed from SIM_SEED
app/routers/       # layout.py robots.py dashboard.py orders.py events.py handheld.py sim.py ws.py
app/sim/engine.py  # tick loop, assignment, movement, battery, faults, order generator
app/sim/path.py    # grid route finder (pure Python; swaps to native addon if importable)
```

**Simulation (tick 200 ms)**
1. Order generator: new order every ~6 s, 1–5 lines, creating `pick` tasks at random rack locations, destination a pick/pack station.
2. Assigner: each pending task goes to the nearest `idle` robot.
3. Movement: robots follow a Manhattan route along aisles at 1.5 m/s; at the task location they switch to `picking` for ~2 s, then `done`.
4. Battery drains while moving; < 20 % → dispatch to nearest charger (`charging`, +2 %/s) and emit `LOW_BATTERY`.
5. Faults: 0.5 % per robot-minute, plus forced by `POST /sim/faults`. Faulted robots stop and emit `ROBOT_FAULT`; auto-recover after 20 s (`ROBOT_RECOVERED`).
6. Order completes when all its lines are done → `ORDER_DONE`.
7. KPI sampler appends a `KpiPoint` every 5 s (in-memory ring buffer; persisted lazily).
8. Handheld tasks: a subset of `pick` tasks flagged `handheld=true` are surfaced by `next-task`; confirming marks the task done and frees the robot's wait.
9. Persistence: snapshot robots/orders/tasks/events to Postgres every 10 s and on shutdown; restore on boot. Correctness of the snapshot under crash is **not** a goal.

**Config (env):** `DATABASE_URL`, `SIM_SEED=42`, `SIM_ROBOTS=200`, `CORS_ORIGINS=*`.

**Optional native addon (stretch):** `native/pathfinder` — C++17 + pybind11 grid A* exposed as `pathfinder.find_path(grid, start, goal)`. `sim/path.py` does `try: import pathfinder` and falls back to Python. Docker multi-stage build compiles the wheel. Benchmark script prints the speedup for the README.

## 11. Infrastructure (AWS, Terraform)

Region `ap-southeast-2`. Local state. `default_tags { project = "woc", ttl = "destroy-today" }`.

| Resource | Config |
|---|---|
| VPC | 10.0.0.0/16; 2 public subnets (ALB + Fargate), 2 isolated subnets (RDS); IGW; **no NAT** |
| Security groups | `alb`: ingress 80 from the CloudFront managed prefix list `com.amazonaws.global.cloudfront.origin-facing`; `api`: 8000 from `alb`; `db`: 5432 from `api` |
| ECR | `woc-api`, `force_delete = true` |
| RDS | Postgres 16, `db.t4g.micro`, 20 GB gp3, single-AZ, `skip_final_snapshot`, no deletion protection, not publicly accessible; password from `random_password` stored as SSM SecureString and injected into the task via ECS `secrets` |
| ECS | Cluster `woc`; Fargate service `woc-api`, desired 1, 0.5 vCPU / 1 GB, public IP, ALB target group health check `/healthz`; log group retention 1 day |
| ALB | Internet-facing, HTTP :80 listener → target group; idle timeout 300 s (WebSocket) |
| S3 | Private bucket for SPA build, OAC from CloudFront, `force_destroy = true` |
| CloudFront | Origins: S3 (OAC) and ALB (http-only). Behaviors: default → S3 with SPA rewrite via **CloudFront Function** (viewer-request: rewrite extension-less paths to `/index.html`; *not* distribution-wide 404→index, which would break API errors); `/api/*`, `/ws/*`, `/healthz` → ALB with caching disabled and `AllViewerExceptHostHeader` origin-request policy. Price class 200 or lower |
| IAM | ECS execution role (ECR pull, logs, SSM read), task role (none needed) |
| Budgets | USD 10 monthly budget with email alert, created first |

Outputs: `cloudfront_url`, `ecr_repo_url`, `rds_endpoint`.

HTTP between CloudFront and ALB is acceptable for a few-hour demo and is restricted by the prefix-list SG; note this in the README rather than adding ACM/Route 53.

**Rough cost while up:** ALB + public IPv4s + Fargate + RDS + minimal CloudFront ≈ USD 0.10–0.20 per hour in Sydney (estimate; confirm with the AWS pricing calculator). A 6-hour showcase should land at about USD 1–2.

## 12. CI/CD and release

**`.github/workflows/ci.yml`** (on push/PR): web — `pnpm i`, lint, typecheck, vitest, `i18n:check`, build; api — `uv sync`, ruff, pytest; OpenAPI drift check (regenerate types, `git diff --exit-code`).

**Release (`scripts/deploy.sh`, run locally; GitHub OIDC deploy = stretch):**
1. `VERSION=$(git describe --tags --always)`
2. `pnpm build` with `VITE_DATA_SOURCE=live` and `VITE_APP_VERSION=$VERSION`
3. `docker buildx build --platform linux/amd64 -t $ECR:$VERSION apps/api` → push
4. `aws s3 sync apps/web/dist s3://$BUCKET --delete`
5. `aws cloudfront create-invalidation --paths "/*"`
6. `aws ecs update-service --force-new-deployment` and wait for stable
7. Smoke: `curl $CF/healthz` and `curl $CF/api/dashboard/summary`

The app version is shown in the Settings page footer, which also proves the release pipeline.

## 13. Testing

| Layer | What |
|---|---|
| Vitest | worker frame decode, store updates, formatters, `RobotPanel` and `EventStream` render |
| Playwright | smoke: dashboard KPIs visible; map canvas present and robot select opens panel; fleet table filter reduces rows; orders drawer opens; handheld "Simulate scan" advances task |
| Playwright shots | `make shots`: fixed viewport, `SIM_SEED`, waits for FPS-stable, writes `docs/screenshots/*.png` |
| pytest | each router returns 200 with seeded data; sim tick moves at least one robot |

## 14. Build plan

Time budgets assume focused agent-assisted work. If a phase runs to 150%, cut to its cut line.

| # | Phase | Budget | Deliverable | Cut line |
|---|---|---|---|---|
| 0 | Scaffold | 0:30 | Monorepo, Vite+TS+Tailwind+shadcn, FastAPI skeleton, Makefile, CI skeleton, i18n wiring | skip CI file until Phase 6 |
| 1 | Shell + mock telemetry + Dashboard | 1:00 | AppShell, `MockSource`, worker, store, S1 | static chart data |
| 2 | Fleet Map (Babylon) | 1:15 | S2 incl. RobotPanel, PerfHud | drop Follow camera |
| 3 | Fleet table + Orders + Events | 1:00 | S3, S4, S5 on mock/MSW | fold S5 into Dashboard list |
| 4 | Handheld + Settings + `ja` | 0:45 | S6, S7, full `ja`, PWA manifest | `ja` only on nav/dashboard/handheld |
| 5 | Backend | 1:15 | Models, seed, sim, all §9 endpoints, WS, Dockerfile | skip DB snapshot persistence |
| 6 | Integrate | 0:45 | `make gen-api`, switch to live, fix drift, Playwright smoke, CI green | 3 of 5 smoke flows |
| 7 | AWS | 1:15 | Terraform, `make infra-up`, `make deploy`, working CloudFront URL | skip Budgets resource (set manually) |
| 8 | Showcase + teardown | 0:45 | Screenshots, recording, README, `make infra-down`, verified zero resources | skip GIF |

Total ≈ 8h30. **MVP path (~6h):** apply every cut line, drop the pybind11 addon, skip Events page.

Order of work rationale: Phases 1–4 run entirely on mock data, so the frontend is demonstrable before any backend or AWS exists. The backend is then built to satisfy the contract the frontend already used.

## 15. Showcase plan

Run `make shots` against the live CloudFront URL while the stack is up. Output to `docs/screenshots/`.

| # | Screenshot | Shows |
|---|---|---|
| 01 | Dashboard, dark, EN | KPIs, throughput, live events |
| 02 | Dashboard, JA | localization |
| 03 | Fleet Map, top view, robot selected + panel | Babylon, selection, mutation UI |
| 04 | Fleet Map, isometric with PerfHud (≥55 FPS) | WebGL performance |
| 05 | Fleet table, filtered + sorted | virtualization, live cells |
| 06 | Orders with drawer and task timeline | workflow UI |
| 07 | Events stream after "Inject fault" (toast + red robot) | ops/incident flow |
| 08 | Handheld, pick task, 360×800 | industrial Android UX |
| 09 | Handheld, scan success flash | scanner input handling |
| 10 | Settings with version + Live indicator | release pipeline |
| 11 | Chrome Performance panel or React Profiler, telemetry commits low | profiling story |
| 12 | GitHub Actions green run | CI |
| 13 | AWS console: CloudFront + ECS service running + RDS available | real AWS deploy |
| 14 | `terraform apply` output (outputs block) | IaC |
| 15 | `terraform destroy` complete + `verify-destroyed` output | cost discipline |

Headless runs cannot screenshot the AWS console, so items 13–15 are replaced by CLI evidence saved in `docs/evidence/` (see `CLAUDE.md §11`): `terraform-apply.txt`, `terraform-outputs.json`, `ecs-service.json`, `rds-instance.json`, `cloudfront-distribution.json`, `cloudwatch-logs.txt`, `cost-estimate.md`, `destroy-verified.txt`. Real console screenshots can be added manually if the stack is still up.

Also capture (if tooling allows): one 30–45 s screen recording (map → select robot → recall → inject fault → events → switch to JA → handheld), and a CloudWatch Logs screenshot of the fault event.

**Deliverables after teardown**
- `README.md`: one-paragraph pitch, architecture diagram (Mermaid), coverage matrix (§2), 8–10 chosen screenshots, run-locally instructions (`make dev-mock`, `make dev`), "what I would harden next" list (auth, validation, observability, multi-task scaling with Redis pub/sub, HTTPS/ACM).
- Optional free permanent demo: `pnpm build:mock` deployed to GitHub Pages or any static host.

## 16. Teardown and verification

1. Finish screenshots/recording first; confirm files exist locally.
2. `make infra-down` (requires explicit user confirmation) → `terraform destroy`.
3. `scripts/verify-destroyed.sh`:
   - `aws resourcegroupstaggingapi get-resources --tag-filters Key=project,Values=woc` → must be empty
   - `aws cloudfront list-distributions`, `aws elbv2 describe-load-balancers`, `aws rds describe-db-instances`, `aws ecs list-clusters`, `aws ec2 describe-nat-gateways`, `aws ec2 describe-addresses` → nothing belonging to `woc`
4. Allow 5–15 min for CloudFront; re-run verification.
5. Next morning: check Cost Explorer; expect single-digit USD or less. Keep the Budget alert off until after confirming no resources remain, then let it expire with the account's normal budgets.

## 17. Stretch (only after Phase 8, in this order)

1. pybind11 `pathfinder` C++ addon + benchmark.
2. Capacitor Android wrapper producing a debug APK for `/handheld`.
3. GitHub Actions deploy via OIDC role.
4. Storybook for `KpiTile`, `StatusBadge`, `RobotPanel`.
5. Cognito login with `operator` / `admin` roles.
6. Web-worker-side OffscreenCanvas for the Babylon scene.

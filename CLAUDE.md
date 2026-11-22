# CLAUDE.md — Warehouse Ops Console (WOC)

Engineering rules for Claude Code. Read this file, then `SPECS.md`, before touching anything.

## 1. Mission

A **one-day portfolio build** that proves full-stack coverage for a Frontend Engineer role on a Warehouse Execution System (WES) & Fleet Management team (React / TypeScript / Babylon.js / WebGL / Python / Linux / localization / industrial Android).

- **Frontend-led.** The UI is the product. The backend exists only to feed screens.
- **Breadth over depth.** Every item in the SPECS coverage matrix must be visibly present. None needs to be bulletproof.
- **Ephemeral deploy.** Deploy to AWS for a few hours, take screenshots, destroy everything. Cost control is a hard rule (section 7).

## 2. Scope guard (most important section)

1. **Happy path only.** No edge-case handling, no business-rule validation, no retries/backoff beyond what a library gives for free, no auth hardening, no pagination edge cases, no concurrency correctness. If the demo path works, stop.
2. **Do not build anything not in SPECS.md.** If you think of a good idea, append one line to `SPECS.md §17 Stretch` and move on.
3. **Time-boxes are real.** Each phase in SPECS §14 has a budget. At 150% of budget, cut to that phase's cut line and continue.
4. **Backend is supporting.** Add an endpoint only when a screen in SPECS §7 needs the data. Every endpoint must list its consuming screen in SPECS §9. No speculative endpoints, no admin CRUD.
5. **No polish before function.** README polish, animations and pixel-tweaking happen only in Phase 8.
6. **Pick the simpler option when ambiguous**, and record it as one line in `DECISIONS.md`. Do not stop to ask; in autonomous mode (§11) decide, note it in `DECISIONS.md`, and continue.

## 3. Stack (use exactly this; commit lockfiles; use latest stable at build time)

| Layer | Choice |
|---|---|
| Web | React + TypeScript (strict), Vite, React Router |
| State | TanStack Query (server state), Zustand (client + telemetry store) |
| UI | Tailwind CSS, shadcn/ui (Radix) primitives, lucide-react icons |
| Tables / charts | TanStack Table + TanStack Virtual, Recharts |
| 3D | Babylon.js (`@babylonjs/core` only; tree-shaken imports) |
| i18n | i18next + react-i18next, locales `en`, `ja` |
| Threading | Web Worker (telemetry parsing/batching), Comlink optional |
| API types | `openapi-typescript` generated from FastAPI OpenAPI |
| Mocking | In-browser `MockSource` (same interface as live WS) + MSW for REST |
| Web tests | Vitest + Testing Library, Playwright (smoke + screenshots) |
| Handheld | Same React app, `/handheld` route, PWA manifest (Capacitor APK = stretch) |
| API | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 async + asyncpg, `uv` |
| DB | PostgreSQL 16 (RDS in AWS, container locally) |
| API tests | pytest + httpx `TestClient` |
| Infra | Terraform (local state), AWS `ap-southeast-2` |
| CI | GitHub Actions |
| Local | Docker Compose, Makefile |

## 4. Repo layout

```
woc/
  CLAUDE.md  SPECS.md  DECISIONS.md  README.md  Makefile  docker-compose.yml
  apps/
    web/    src/{app,api,telemetry,components,features,i18n,lib}  e2e/  public/
    api/    app/{main.py,db.py,models.py,schemas.py,seed.py,routers/,sim/}  tests/  Dockerfile  pyproject.toml
  native/pathfinder/        # STRETCH: C++17 + pybind11 addon
  infra/terraform/
  scripts/                  # deploy.sh, verify-destroyed.sh, shots.sh
  docs/screenshots/
  .github/workflows/
```

`src/features/<name>/` owns its components, hooks and queries. Shared things go in `src/components` or `src/lib` only when used by 2+ features.

## 5. Commands (all must exist in the Makefile; keep them working)

```
make setup         # pnpm install + uv sync
make dev-mock      # web only, VITE_DATA_SOURCE=mock  (frontend-first workflow)
make dev           # docker compose up db + api, web against live API
make check         # lint + typecheck + unit tests + i18n:check (web) ; ruff + pytest (api)
make gen-api       # regenerate apps/web/src/api/schema.d.ts from running API's openapi.json
make shots         # Playwright screenshot run -> docs/screenshots/
make infra-up      # terraform apply (see §7 for the required order and confirmation)
make deploy        # build web + api image, push, sync S3, invalidate CF, roll ECS
make infra-down    # terraform destroy + scripts/verify-destroyed.sh
```

Run `make check` at the end of every phase. Do not move on while it fails.

## 6. Code rules

### Frontend
- TypeScript `strict`. No `any` (use `unknown` + narrowing). Prefer string-literal unions over `enum`.
- **No `fetch` in components.** All HTTP goes through `src/api/` (typed client). All realtime goes through `src/telemetry/`.
- **Server state = TanStack Query. UI state = Zustand/local.** Do not mirror server data into Zustand except telemetry.
- **Telemetry never drives React renders at wire rate.**
  - WebSocket → Web Worker (parse, diff, batch) → `postMessage` with a transferable `Float32Array` → Zustand `telemetryStore` (plain mutable typed arrays, not React state).
  - Babylon reads the store via `getState()` inside its render loop.
  - React components subscribe to *throttled* (≤2 Hz) or *per-row* selectors.
- **Long lists (>100 rows) must be virtualized.**
- **Every user-visible string goes through `t()`.** Keys live in `src/i18n/en.json` and `ja.json`; `pnpm i18n:check` (script) fails on missing/unused keys. Format dates/numbers with `Intl`, never by hand. Backend sends event `code` + `params`, never display text.
- **Babylon discipline:** dispose scene/engine on unmount; thin instances for robots and racks; `freezeWorldMatrix()` / `freezeMaterial()` on static meshes; zero allocations inside the render loop; one engine per page; resize via `ResizeObserver`.
- Styling: Tailwind utility classes + design tokens (CSS variables). Dark theme is the default (control-room context). On `/handheld`, touch targets are ≥ 48px and font ≥ 18px.
- One `ErrorBoundary` per route and one skeleton per data screen. Empty states are a single line of text. That is all the resilience we build.
- Components: function components, named exports, files under ~200 lines. Split when bigger.

### Backend
- Layering is `routers → services (plain functions) → models`. No repository pattern, no DI container, no abstract base classes.
- `async` end-to-end. Pydantic models are the only response shapes; the generated OpenAPI is the contract.
- The simulator is one `asyncio` task started in FastAPI `lifespan`. State is in memory and snapshotted to Postgres on a slow interval. **Single process, single ECS task. No Redis, no queue, no workers.**
- Deterministic: sim uses `SIM_SEED` so screenshots are repeatable.
- No auth, no rate limiting, no input validation beyond Pydantic type defaults.
- Seed on startup if tables are empty.
- Lint: `ruff check` + `ruff format`. Type hints required on public functions; do not fight mypy.

### General
- Conventional commits (`feat:`, `fix:`, `chore:`, `infra:`, `docs:`). One commit per finished sub-feature. Work on `main`; no PR ceremony.
- No secrets in git. `.gitignore` must cover `*.tfstate*`, `*.tfvars`, `.env*`, `node_modules`, `.venv`, `dist`.
- Comments explain *why*, not *what*. No dead code, no TODO litter (use SPECS §17).
- Prefer boring, well-known libraries. Do not write a custom UI kit, state library, or router.

## 7. AWS and cost rules (non-negotiable)

**Autonomous mode is authorized by the user for this project** (see §11). Claude may run `terraform apply/destroy`, `docker push`, `aws s3 sync`, ECS updates and CloudFront invalidations **without asking**, but only inside the guardrails below: account lock, `project=woc` scope, forbidden-resource list, spend/time caps. Anything outside those guardrails is not authorized and must not be run. Always run `terraform plan` before `apply` and read it: if the plan contains a forbidden resource, or any resource outside this project's own Terraform config, stop and fix the config.

Design constraints:
- Region `ap-southeast-2`. Terraform ≥ 1.9, **local state** (no S3/DynamoDB backend, so nothing is left behind).
- **Every resource tagged** `project=woc`, `ttl=destroy-today` (use provider `default_tags`).
- **Forbidden** (cost or leftover risk): NAT Gateway, multi-AZ anything, ElastiCache, OpenSearch, EKS, Route 53 hosted zones, WAF, provisioned IOPS, Secrets Manager (use SSM Parameter Store), unattached Elastic IPs, RDS snapshots retained after destroy.
- **Destroy-friendly flags are mandatory:** S3 `force_destroy = true`, ECR `force_delete = true`, RDS `skip_final_snapshot = true` and `deletion_protection = false`, CloudWatch log retention = 1 day.
- Fargate tasks run in public subnets with a public IP (avoids NAT). RDS lives in isolated subnets with no internet route.
- Create an **AWS Budget alert at USD 10** before anything else is created.
- First apply order (ECS needs an image to exist): `terraform apply -target=aws_ecr_repository.api` → push image → full `terraform apply`. `make infra-up` encapsulates this.
- After destroy, run `scripts/verify-destroyed.sh`. It must report **zero** resources tagged `project=woc`. CloudFront deletion can take 5–15 minutes; do not declare done before verification passes.
- Never print or commit AWS credentials.

### AWS access (already configured by the user)

- Use the local AWS CLI with **profile `warehouse`**: `export AWS_PROFILE=warehouse` (PowerShell: `$env:AWS_PROFILE="warehouse"`). Set `AWS_REGION=ap-southeast-2` and `AWS_PAGER=""` too. Terraform's provider block must use `profile = "warehouse"`, `region = "ap-southeast-2"`.
- Expected identity: account **727965304944**, IAM user `warehouse-deployer` (`arn:aws:iam::727965304944:user/warehouse-deployer`).
- **Before any command that creates or changes resources**, run `aws sts get-caller-identity --profile warehouse` and confirm the Account is `727965304944`. If it differs, stop and tell the user. Hard-code this account ID in Terraform (`allowed_account_ids = ["727965304944"]`) so it cannot touch any other account.
- Allowed without asking: `aws sts get-caller-identity`, `describe-*`, `list-*`, `get-*`, `terraform init/validate/fmt/plan`, `docker build`, and reading logs.
- Allowed in autonomous mode (guardrails apply): `terraform apply`, `terraform destroy`, `docker push` to the project's own ECR repo, `aws s3 sync` to the project's own bucket, `aws ecs update-service` on the `woc` cluster, `aws cloudfront create-invalidation` on the project's own distribution.
- The `warehouse-deployer` user holds `PowerUserAccess` + `IAMFullAccess` (effectively admin), so the guardrails here are the only limit. IAM changes are allowed **only** for roles/policies/instance-profiles named with the prefix `woc-` that Terraform creates (ECS execution and task roles) plus the AWS service-linked roles that ECS/ELB/RDS create automatically. Every other IAM action is forbidden.
- Never allowed, even in autonomous mode: any `aws ... delete-*`/`terminate-*`/`put-*`/`update-*` on a resource that is not tagged `project=woc` or not created by this repo's Terraform; creating IAM users, access keys or policies beyond the ECS roles; changing the `warehouse-deployer` user itself; touching any other account.
- If an `AccessDenied` appears, do not try to widen permissions or create IAM users/keys. Report the missing action and let the user adjust the `warehouse-deployer` policy. Expected needs: EC2/VPC, ELBv2, ECS, ECR, RDS, S3, CloudFront, IAM (roles and policies for ECS only), SSM, CloudWatch Logs, Budgets, Resource Groups Tagging (read).
- Windows note: the user's shell is Windows. Run the Makefile and `scripts/*.sh` from **WSL or Git Bash**. If neither is available, provide PowerShell equivalents in `scripts/` rather than rewriting the Makefile.

## 8. Testing (proportional on purpose)

- Vitest: telemetry worker (decode/diff), stores, `formatters`, one component test per feature.
- Playwright: 5 smoke flows (dashboard loads, twin selects a robot, table filters, order drawer opens, handheld confirms a pick) plus the screenshot run.
- pytest: one smoke test per router, one sim "tick advances state" test.
- Do not chase coverage numbers. Do not test error paths.

## 9. Definition of done (per feature)

- [ ] Works in `mock` mode **and** against the real API
- [ ] Strings present in `en` and `ja`; `pnpm i18n:check` passes
- [ ] Renders correctly in dark theme at 1440×900 (and 360×800 for `/handheld`)
- [ ] `make check` green
- [ ] Screenshot captured by `make shots` if it appears in SPECS §15

## 10. How to work

1. Announce the current phase (SPECS §14) in one line, then do it.
2. Build the **mock path first** for every screen; only then wire the real API. This keeps the frontend unblocked and is what the data contract in SPECS §9 is for.
3. When a screen needs data the API lacks, add the endpoint to SPECS §9 first (one row), then to the backend, then regenerate types with `make gen-api`.
4. Keep final replies short: what changed, what runs, what is next.

## 11. Autonomous mode (user-authorized)

The user has asked for a fully autonomous run: implement SPECS.md end to end, commit and push iteratively, deploy to AWS, gather screenshot and log evidence, then destroy. Do not pause for confirmation between phases.

**Project isolation ("don't touch other projects")**
- Work only inside this repo's folder (`vie-warehouse-ops`). Never read, edit, move or delete sibling folders (e.g. `mini-wes`, `vie-sentinel`, `vie-openfleet`) or anything outside the repo, except installing tools and writing the final evidence files into this repo.
- GitHub: use the logged-in `gh` CLI. Create **one new repository named `vie-warehouse-ops`** (private by default) from this folder: `gh repo create vie-warehouse-ops --private --source . --remote origin --push`. If it already exists and is empty, use it; if it exists with content, stop and report. Never push to, modify, fork or delete any other repository, and never change GitHub account/org settings or secrets.
- AWS: only `--profile warehouse`, account `727965304944`, region `ap-southeast-2`, and only resources created by this repo's Terraform (tagged `project=woc`).

**Git cadence**
- Commit at the end of every phase and after each finished screen/endpoint, with conventional-commit messages; `git push` after each phase. Never force-push. Do not commit screenshots larger than needed (keep PNG ≤ ~1.5 MB each) and never commit `.tfstate`, `.tfvars`, `.env`, credentials or the AWS config.
- Append the `Co-Authored-By` trailer given by the harness to commit messages.

**Run order**
1. Phases 0–6 locally (SPECS §14). `make check` green before each push.
2. Phase 7: `terraform plan` → `apply` → deploy → smoke-test the CloudFront URL (`/healthz`, `/api/dashboard/summary`, WS connects).
3. Phase 8: run `make shots` against the live URL; capture evidence into `docs/evidence/`:
   - `docs/screenshots/*.png` (SPECS §15)
   - `docs/evidence/terraform-apply.txt`, `terraform-outputs.json` (redact nothing secret; the DB password must never appear)
   - `docs/evidence/ecs-service.json`, `rds-instance.json` (trimmed `describe-*` output: status, size, endpoint host only), `cloudfront-distribution.json` (id, domain, status)
   - `docs/evidence/cloudwatch-logs.txt` (last ~100 lines containing the fault event; remove any secrets)
   - `docs/evidence/cost-estimate.md` (instance-hours × rates, with the apply and destroy timestamps)
   - Browser screenshots via Playwright (headless Chromium). AWS-console screenshots are not possible headless: use the CLI JSON evidence above instead and say so in the README.
4. Commit and push the evidence **before** destroying.
5. `terraform destroy` → `scripts/verify-destroyed.sh` → save output to `docs/evidence/destroy-verified.txt` → commit and push.
6. Finalize `README.md` (embed the screenshots, link to evidence, note the stack is destroyed, point to `make dev-mock`), push.

**Safety rails (abort conditions)**
- **Destroy always runs** before finishing, even if a deploy or screenshot step failed. On failure: capture whatever logs exist, destroy, verify, then report. Never leave the stack up when the run ends.
- Caps: stop deploying and destroy if the stack has been up for more than **4 hours** or the Budget alert fires.
- If `terraform apply` fails halfway, run `terraform destroy` on the partial state before retrying from scratch (max 2 retries).
- If `verify-destroyed.sh` still finds resources after 20 minutes, report each one by ID and the exact command needed to delete it; do not delete anything that is not tagged `project=woc`.
- If a tool or permission is missing (e.g. `AccessDenied`, Docker unavailable), do not work around it by widening permissions. Use the fallback (e.g. build the image in GitHub Actions is **not** pre-authorized; instead report and skip to local-only evidence plus mock-mode build) and continue with what is possible.

**Final report (short):** repo URL, CloudFront URL (now dead), list of evidence files, total hours the stack was up, destroy-verified status, and anything cut.

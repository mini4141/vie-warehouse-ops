# DECISIONS

One line per ambiguity resolved (CLAUDE.md §2.6).

- Pinned `@tanstack/react-table` to v8: v9 is a rewrite with a different API; v8 is the documented, boring choice.
- Pinned `typescript` to 6.x: `typescript-eslint` does not support TS 7 yet.
- `cross-env` for `build:mock` so it works from PowerShell, Git Bash and CI alike.
- Mock mode serves REST through MSW (service worker) and telemetry through `MockSource`; both read one seeded `MockWorld`.
- Worker allocates a fresh `Float32Array` per frame (5 Hz, ~4 KB) and transfers it; a pool/round-trip would add complexity for no visible gain.
- Fleet table re-fetches the robot snapshot every 5 s so sort/filter stay roughly current; live cells (status, battery, position) use per-row subscriptions.
- Order generator interval is 3 s (spec says ~6 s) so a 200-robot fleet shows visible utilization.
- Paused robots report their normal status with speed 0 in the mock; the API reports `idle`.
- Event reason params (`motor`, `sensor`, `blocked`) are i18n keys, so they translate too.
- A tiny `window.__woc.robotScreenPos` hook exists solely so Playwright can click a real robot on the canvas.
- `ja` translations are Claude-drafted and need native review before any real use.

// Mutable counters read by PerfHud. A plain object on purpose: writing here never triggers a React render.
export const perf = {
  fps: 0,
  robots: 0,
  commits: 0,
  wsMsgs: 0,
  sceneSetupMs: 0,
}

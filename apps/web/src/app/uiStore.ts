import { create } from 'zustand'
import type { RobotStatus } from '@/api/types'

export type Theme = 'dark' | 'light' | 'high-contrast'
export type Density = 'comfortable' | 'compact'
export type CameraMode = 'top' | 'iso' | 'follow'

const load = <T extends string>(key: string, fallback: T): T => {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback
  } catch {
    return fallback
  }
}
const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable: preference just won't persist */
  }
}

interface UiState {
  theme: Theme
  density: Density
  selectedRobotId: string | null
  hiddenStatuses: RobotStatus[]
  cameraMode: CameraMode
  setTheme: (t: Theme) => void
  setDensity: (d: Density) => void
  selectRobot: (id: string | null) => void
  toggleStatus: (s: RobotStatus) => void
  setCameraMode: (m: CameraMode) => void
}

export const useUiStore = create<UiState>()((set) => ({
  theme: load<Theme>('woc.theme', 'dark'),
  density: load<Density>('woc.density', 'comfortable'),
  selectedRobotId: null,
  hiddenStatuses: [],
  cameraMode: 'iso',
  setTheme: (theme) => { save('woc.theme', theme); set({ theme }) },
  setDensity: (density) => { save('woc.density', density); set({ density }) },
  selectRobot: (selectedRobotId) => set({ selectedRobotId }),
  toggleStatus: (s) =>
    set((st) => ({ hiddenStatuses: st.hiddenStatuses.includes(s) ? st.hiddenStatuses.filter((x) => x !== s) : [...st.hiddenStatuses, s] })),
  setCameraMode: (cameraMode) => set({ cameraMode }),
}))

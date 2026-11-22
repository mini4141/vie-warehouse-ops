/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'mock' | 'live'
  readonly VITE_APP_VERSION?: string
}

interface Window {
  __woc?: { robotScreenPos: (index: number) => { x: number; y: number } }
}

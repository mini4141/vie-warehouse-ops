// Owns the WebSocket so JSON parsing and diffing never run on the UI thread.
import { decodeRobots, parseMessage } from './decode'
import type { WorkerIn, WorkerOut } from './types'

const RECONNECT_MS = 1000
let socket: WebSocket | null = null
let wantOpen = false
let lastFull: Float32Array | null = null
let msgs = 0

const send = (msg: WorkerOut, transfer: Transferable[] = []) => self.postMessage(msg, { transfer })

function open(url: string) {
  send({ type: 'state', state: 'connecting' })
  const ws = new WebSocket(url)
  socket = ws
  ws.onopen = () => send({ type: 'state', state: 'live' })
  ws.onmessage = (e: MessageEvent<string>) => {
    msgs++
    const msg = parseMessage(e.data)
    if (!msg) return
    if (msg.type === 'robots') {
      const buf = decodeRobots(msg.r, lastFull)
      lastFull = buf.slice()
      send({ type: 'frame', t: msg.t, buf }, [buf.buffer])
    } else if (msg.type === 'event') {
      send({ type: 'event', event: msg.event })
    } else {
      send({ type: 'counts', counts: { online: msg.online, total: msg.total, byStatus: msg.byStatus } })
    }
  }
  ws.onclose = () => {
    if (!wantOpen) return
    send({ type: 'state', state: 'reconnecting' })
    setTimeout(() => wantOpen && open(url), RECONNECT_MS)
  }
}

setInterval(() => {
  send({ type: 'stats', msgsPerSec: msgs })
  msgs = 0
}, 1000)

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  if (e.data.type === 'connect') {
    wantOpen = true
    open(e.data.url)
  } else {
    wantOpen = false
    socket?.close()
  }
}

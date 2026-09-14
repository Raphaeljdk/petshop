import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

function getSocket(): Socket | null {
  if (typeof window !== 'undefined') return null
  if (socket && socket.connected) return socket
  try {
    socket = io('http://localhost:3003', {
      path: '/',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 3,
      timeout: 2000,
    })
    socket.on('connect_error', () => {})
    return socket
  } catch {
    return null
  }
}

export async function emitWebSocket(event: string, data: any): Promise<void> {
  try {
    const s = getSocket()
    if (s && s.connected) {
      s.emit('broadcast', { event, data })
    }
  } catch (e) {
    console.error('WebSocket emit falhou:', e)
  }
}

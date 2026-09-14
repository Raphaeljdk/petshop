'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface RealtimeEvent {
  event: string
  handler: (data: any) => void
}

interface UseRealtimeReturn {
  isConnected: boolean
  socket: Socket | null
}

export function useRealtime(events: RealtimeEvent[]): UseRealtimeReturn {
  const [isConnected, setIsConnected] = useState(false)
  const eventsRef = useRef<RealtimeEvent[]>(events)

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  // Cria o socket uma única vez (lazy init) — só no cliente
  const [socket] = useState<Socket | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return io('/?XTransformPort=3003', {
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      })
    } catch (e) {
      console.error('useRealtime init erro:', e)
      return null
    }
  })

  useEffect(() => {
    if (!socket) return

    const registerAll = () => {
      for (const ev of eventsRef.current) {
        socket.off(ev.event)
        socket.on(ev.event, (data: any) => {
          try {
            ev.handler(data)
          } catch (e) {
            console.error('useRealtime handler erro:', e)
          }
        })
      }
    }

    registerAll()

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)
    const onError = () => setIsConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onError)

    const interval = setInterval(() => {
      if (socket.connected) {
        registerAll()
      }
    }, 2000)

    return () => {
      clearInterval(interval)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onError)
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [socket])

  return { isConnected, socket }
}

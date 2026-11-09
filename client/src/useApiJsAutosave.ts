import { useEffect, useRef, useState } from 'react'

export type ApiJsSaveStatus = 'saved' | 'saving' | 'failed'

interface SaveQueue {
  initialized: boolean
  source: string
  version: number
  savedVersion: number
  timer: ReturnType<typeof setTimeout> | null
  due: boolean
  inFlight: boolean
  blocked: boolean
  mounted: boolean
}

const DEBOUNCE_MS = 1000

export function useApiJsAutosave(initialSource: string | null) {
  const [status, setStatus] = useState<ApiJsSaveStatus>('saved')
  const queueRef = useRef<SaveQueue>({
    initialized: false,
    source: '',
    version: 0,
    savedVersion: 0,
    timer: null,
    due: false,
    inFlight: false,
    blocked: false,
    mounted: false,
  })

  useEffect(() => {
    const queue = queueRef.current
    queue.mounted = true
    return () => {
      queue.mounted = false
      if (queue.timer) clearTimeout(queue.timer)
      queue.timer = null
    }
  }, [])

  useEffect(() => {
    const queue = queueRef.current
    if (initialSource === null || queue.initialized) return
    queue.initialized = true
    queue.source = initialSource
    queue.savedVersion = queue.version
  }, [initialSource])

  async function drainQueue() {
    const queue = queueRef.current
    if (queue.inFlight || queue.blocked || !queue.due || queue.version === queue.savedVersion) return

    const source = queue.source
    const version = queue.version
    queue.due = false
    queue.inFlight = true

    try {
      const response = await fetch('/api/session/api-js', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: source,
      })
      if (!response.ok) throw new Error(`Save failed with HTTP ${response.status}`)

      queue.savedVersion = version
      if (queue.version === version && queue.mounted) setStatus('saved')
      else if (queue.mounted) setStatus('saving')
    } catch {
      if (queue.version === version) {
        queue.blocked = true
        queue.due = true
        if (queue.mounted) setStatus('failed')
      } else if (queue.mounted) {
        setStatus('saving')
      }
    } finally {
      queue.inFlight = false
      if (queue.due && !queue.blocked) void drainQueue()
    }
  }

  function scheduleSave() {
    const queue = queueRef.current
    if (queue.timer) clearTimeout(queue.timer)
    queue.due = false
    queue.timer = setTimeout(() => {
      queue.timer = null
      queue.due = true
      void drainQueue()
    }, DEBOUNCE_MS)
  }

  function onSourceChange(source: string) {
    const queue = queueRef.current
    if (!queue.initialized) return
    queue.source = source
    queue.version += 1
    queue.blocked = false
    setStatus('saving')
    scheduleSave()
  }

  function retry() {
    const queue = queueRef.current
    if (!queue.initialized) return
    if (queue.timer) clearTimeout(queue.timer)
    queue.timer = null
    queue.blocked = false
    queue.due = true
    setStatus('saving')
    void drainQueue()
  }

  return { status, onSourceChange, retry }
}

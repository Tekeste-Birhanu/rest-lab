import { useCallback, useEffect, useRef, useState } from 'react'
import type { NetworkEntry } from './request-broker.ts'
import { connectRequestBroker, createApiWorker } from './worker-client.ts'

export type ConsoleEntry = { id: string; kind: 'log' | 'error' | 'info'; text: string }

type RunnerStatus = 'idle' | 'running'
type WorkerMessage =
  | { type: 'console'; runId: string; text: string }
  | { type: 'runtime-error'; runId: string; name: string; message: string }
  | { type: 'complete'; runId: string }

type WorkerConnection = ReturnType<typeof connectRequestBroker> & { worker: Worker }

const RUN_TIMEOUT_MS = 30_000

export function useApiJsRunner() {
  const connectionRef = useRef<WorkerConnection | null>(null)
  const [status, setStatus] = useState<RunnerStatus>('idle')
  const [entries, setEntries] = useState<ConsoleEntry[]>([])
  const [networkEntries, setNetworkEntries] = useState<NetworkEntry[]>([])
  const [startupError, setStartupError] = useState<string | null>(null)
  const runIdRef = useRef<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearRunTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }, [])

  const ensureWorker = useCallback(() => {
    if (connectionRef.current) return connectionRef.current
    const worker = createApiWorker()
    const connection = {
      ...connectRequestBroker(worker, window.location.origin, undefined, (entry) => {
        setNetworkEntries((current) => {
          const existingIndex = current.findIndex((item) => item.id === entry.id && item.runId === entry.runId)
          if (existingIndex === -1) return [...current, entry].sort((left, right) => left.startedAt - right.startedAt)
          const updated = [...current]
          updated[existingIndex] = entry
          return updated
        })
      }),
      worker,
    }
    connectionRef.current = connection
    const onMessage = (event: MessageEvent<unknown>) => {
      const message = event.data as Partial<WorkerMessage> | null
      if (!message || typeof message !== 'object' || message.runId !== runIdRef.current) return
      if (message.type === 'console' && typeof message.text === 'string') {
        setEntries((current) => [...current, { id: crypto.randomUUID(), kind: 'log', text: message.text! }])
      } else if (message.type === 'runtime-error') {
        const detail = [message.name, message.message].filter((part) => typeof part === 'string').join(': ')
        setEntries((current) => [...current, { id: crypto.randomUUID(), kind: 'error', text: detail || 'JavaScript runtime error' }])
        connectionRef.current?.stopRun(message.runId)
        clearRunTimer()
        runIdRef.current = null
        setStatus('idle')
      } else if (message.type === 'complete') {
        connectionRef.current?.stopRun(message.runId)
        clearRunTimer()
        runIdRef.current = null
        setStatus('idle')
      }
    }
    const onError = () => {
      const activeRunId = runIdRef.current
      if (activeRunId) connection.stopRun(activeRunId)
      clearRunTimer()
      setStartupError('The JavaScript Worker failed. Run it again to start a fresh Worker.')
      setStatus('idle')
      runIdRef.current = null
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.terminate()
      if (connectionRef.current?.worker === worker) connectionRef.current = null
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    return connection
  }, [clearRunTimer])

  useEffect(() => () => {
    clearRunTimer()
    const connection = connectionRef.current
    if (connection) {
      const runId = runIdRef.current
      if (runId) connection.stopRun(runId)
      connection.worker.terminate()
      connectionRef.current = null
    }
  }, [clearRunTimer])

  const finishRun = useCallback((message: string) => {
    const runId = runIdRef.current
    if (!runId) return
    clearRunTimer()
    const connection = connectionRef.current
    if (connection) {
      connection.stopRun(runId)
      connection.worker.terminate()
      connectionRef.current = null
    }
    runIdRef.current = null
    setStatus('idle')
    setEntries((current) => [...current, { id: crypto.randomUUID(), kind: 'info', text: message }])
  }, [clearRunTimer])

  const run = useCallback((source: string) => {
    if (runIdRef.current) return
    const runId = crypto.randomUUID()
    try {
      const connection = ensureWorker()
      runIdRef.current = runId
      setStartupError(null)
      setStatus('running')
      connection.startRun(runId)
      connection.worker.postMessage({ type: 'run', runId, source })
      timeoutRef.current = setTimeout(() => finishRun('Run timed out after 30 seconds.'), RUN_TIMEOUT_MS)
    } catch {
      runIdRef.current = null
      setStatus('idle')
      setStartupError('The JavaScript Worker could not start. Check the Worker setup and try again.')
    }
  }, [ensureWorker, finishRun])

  const stop = useCallback(() => finishRun('Run stopped.'), [finishRun])
  const clearConsole = useCallback(() => {
    setEntries([])
    setStartupError(null)
  }, [])
  const clearNetwork = useCallback(() => setNetworkEntries([]), [])

  return { status, entries, networkEntries, startupError, run, stop, clearConsole, clearNetwork }
}

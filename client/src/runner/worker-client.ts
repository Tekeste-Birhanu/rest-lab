import { RequestBroker, type NetworkEntry, type WorkerRequest, type WorkerResponse } from './request-broker'
import { WORKER_CSP } from './worker-policy.ts'

export { WORKER_CSP }

export function createApiWorker(): Worker {
  return new Worker('/restlab-worker.js', { type: 'module', name: 'restlab-api' })
}

export function connectRequestBroker(
  worker: Worker,
  origin: string,
  fetcher?: typeof fetch,
  onNetworkEntry?: (entry: NetworkEntry) => void,
) {
  const broker = new RequestBroker({ origin, fetcher, onNetworkEntry })
  worker.addEventListener('message', (event: MessageEvent<unknown>) => {
    const message = event.data
    void broker.handle(message).then((response) => {
      if (response) worker.postMessage(response)
    })
  })
  return {
    broker,
    startRun(runId: string) {
      broker.startRun(runId)
      worker.postMessage({ type: 'start', runId })
    },
    stopRun(runId: string) {
      broker.stopRun(runId)
      worker.postMessage({ type: 'stop', runId })
    },
  }
}

export type { NetworkEntry, WorkerRequest, WorkerResponse }


const activeRuns = new Set()
const pendingRequests = new Map()

self.addEventListener('message', (event) => {
  const message = event.data
  if (!message || typeof message !== 'object') return

  if (message.type === 'start' && typeof message.runId === 'string') {
    activeRuns.add(message.runId)
    return
  }

  if (message.type === 'run' && typeof message.runId === 'string' && typeof message.source === 'string') {
    if (!activeRuns.has(message.runId)) return
    void execute(message.runId, message.source)
    return
  }

  if (message.type === 'stop' && typeof message.runId === 'string') {
    activeRuns.delete(message.runId)
    for (const [requestId, pending] of pendingRequests) {
      if (pending.runId !== message.runId) continue
      pendingRequests.delete(requestId)
      pending.reject(new DOMException('This run has stopped.', 'AbortError'))
    }
    return
  }

  if (message.type === 'response' && typeof message.requestId === 'string') {
    const pending = pendingRequests.get(message.requestId)
    if (!pending) return
    pendingRequests.delete(message.requestId)
    if (message.error) {
      pending.reject(new TypeError(message.error))
      return
    }
    const body = message.status === 204 || message.status === 304 ? null : message.body
    pending.resolve(new Response(body, {
      status: message.status,
      statusText: message.statusText,
      headers: message.headers,
    }))
  }
})

async function execute(runId, source) {
  try {
    const userConsole = {
      log: (...values) => {
        if (activeRuns.has(runId)) self.postMessage({ type: 'console', runId, text: values.map(formatValue).join(' ') })
      },
    }
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const runUserCode = new AsyncFunction('console', 'fetch', `"use strict";\n${source}\n//# sourceURL=api.js`)
    await runUserCode(userConsole, self.fetch)
    if (activeRuns.has(runId)) self.postMessage({ type: 'complete', runId })
  } catch (error) {
    if (activeRuns.has(runId)) {
      self.postMessage({
        type: 'runtime-error',
        runId,
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  } finally {
    activeRuns.delete(runId)
  }
}

function formatValue(value) {
  if (typeof value === 'string') return value
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (value === undefined) return 'undefined'
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'symbol') return String(value)
  try {
    const json = JSON.stringify(value)
    return json === undefined ? String(value) : json
  } catch {
    try { return String(value) } catch { return '[Unprintable value]' }
  }
}

self.fetch = (url, init = {}) => {
  if (url instanceof Request) {
    return Promise.reject(new TypeError('fetch(Request) is not supported. Pass a URL string.'))
  }
  if (typeof url !== 'string') {
    return Promise.reject(new TypeError('fetch expects a URL string.'))
  }
  if (!init || typeof init !== 'object' || Array.isArray(init)) {
    return Promise.reject(new TypeError('fetch init must be an object.'))
  }
  const runId = [...activeRuns].at(-1)
  if (!runId) return Promise.reject(new DOMException('No active run.', 'AbortError'))

  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { runId, resolve, reject })
    self.postMessage({ type: 'request', runId, requestId, url, init })
  })
}

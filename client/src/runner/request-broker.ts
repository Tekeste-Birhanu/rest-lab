export type WorkerRequest = {
  type: 'request'
  runId: string
  requestId: string
  url: string
  init?: unknown
}

export type WorkerResponse = {
  type: 'response'
  requestId: string
  status?: number
  statusText?: string
  headers?: [string, string][]
  body?: string
  error?: string
}

export type NetworkEntry = {
  id: string
  runId: string
  method: string
  url: string
  requestHeaders: [string, string][]
  requestBody?: string
  startedAt: number
  durationMs?: number
  status?: number
  statusText?: string
  responseHeaders?: [string, string][]
  responseBody?: string
  error?: string
}

type BrokerOptions = {
  origin: string
  fetcher?: typeof fetch
  maxBodyBytes?: number
  onNetworkEntry?: (entry: NetworkEntry) => void
}

type PendingRequest = { runId: string; controller: AbortController; networkEntry: NetworkEntry }

const collectionPath = /^\/api\/snippets\/?$/
const detailPath = /^\/api\/snippets\/[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i
const methodsByPath = new Map([
  ['collection', new Set(['GET', 'POST'])],
  ['detail', new Set(['GET', 'PUT', 'PATCH', 'DELETE'])],
])
const allowedInitKeys = new Set(['method', 'headers', 'body'])
const forbiddenHeaders = new Set(['cookie', 'host', 'origin', 'content-length'])

export class RequestBroker {
  private readonly origin: string
  private readonly fetcher: typeof fetch
  private readonly maxBodyBytes: number
  private readonly onNetworkEntry?: (entry: NetworkEntry) => void
  private readonly activeRuns = new Set<string>()
  private readonly pending = new Map<string, PendingRequest>()

  constructor(options: BrokerOptions) {
    this.origin = new URL(options.origin).origin
    this.fetcher = options.fetcher ?? fetch.bind(globalThis)
    this.maxBodyBytes = options.maxBodyBytes ?? 2 * 1024 * 1024
    this.onNetworkEntry = options.onNetworkEntry
  }

  startRun(runId: string): void {
    this.activeRuns.add(runId)
  }

  stopRun(runId: string): void {
    this.activeRuns.delete(runId)
    for (const [requestId, pending] of this.pending) {
      if (pending.runId !== runId) continue
      this.pending.delete(requestId)
      pending.controller.abort()
      this.onNetworkEntry?.({
        ...pending.networkEntry,
        durationMs: performance.now() - pending.networkEntry.startedAt,
        error: 'Request cancelled because the run stopped.',
      })
    }
  }

  async handle(input: unknown): Promise<WorkerResponse | undefined> {
    const invalid = this.validateMessage(input)
    if (invalid) return invalid
    const message = input as WorkerRequest

    if (!this.activeRuns.has(message.runId)) {
      return this.error(message.requestId, 'This run is no longer active.')
    }
    if (this.pending.has(message.requestId)) {
      return this.error(message.requestId, 'Duplicate request ID.')
    }

    let request: { url: URL; method: string; headers: Headers; body?: string }
    try {
      request = this.validateRequest(message.url, message.init)
    } catch (error) {
      return this.error(message.requestId, error instanceof Error ? error.message : 'Invalid request.')
    }

    const controller = new AbortController()
    const startedAt = performance.now()
    const networkEntry: NetworkEntry = {
      id: message.requestId,
      runId: message.runId,
      method: request.method,
      url: request.url.href,
      requestHeaders: [...request.headers.entries()],
      ...(request.body === undefined ? {} : { requestBody: request.body }),
      startedAt,
    }
    this.pending.set(message.requestId, { runId: message.runId, controller, networkEntry })
    this.onNetworkEntry?.(networkEntry)
    try {
      const response = await this.fetcher(request.url, {
        method: request.method,
        headers: request.headers,
        ...(request.body === undefined ? {} : { body: request.body }),
        credentials: 'same-origin',
        redirect: 'error',
        signal: controller.signal,
      })
      const body = await response.text()
      const durationMs = performance.now() - startedAt
      if (!this.activeRuns.has(message.runId)) return undefined
      this.onNetworkEntry?.({
        ...networkEntry,
        durationMs,
        status: response.status,
        statusText: response.statusText,
        responseHeaders: [...response.headers.entries()],
        responseBody: body,
      })
      return {
        type: 'response',
        requestId: message.requestId,
        status: response.status,
        statusText: response.statusText,
        headers: [...response.headers.entries()],
        body,
      }
    } catch (error) {
      if (!this.activeRuns.has(message.runId)) return undefined
      const messageText = error instanceof Error ? error.message : 'Request failed.'
      this.onNetworkEntry?.({ ...networkEntry, durationMs: performance.now() - startedAt, error: messageText })
      return this.error(message.requestId, messageText)
    } finally {
      this.pending.delete(message.requestId)
    }
  }

  private validateMessage(input: unknown): WorkerResponse | undefined {
    if (!isRecord(input) || input.type !== 'request') return undefined
    const { runId, requestId, url } = input
    if (
      typeof runId !== 'string' || runId.length < 1 || runId.length > 100 ||
      typeof requestId !== 'string' || requestId.length < 1 || requestId.length > 100 ||
      typeof url !== 'string' || url.length < 1 || url.length > 2048
    ) {
      return this.error(typeof requestId === 'string' ? requestId : '', 'Malformed request message.')
    }
    if (Object.keys(input).some((key) => !['type', 'runId', 'requestId', 'url', 'init'].includes(key))) {
      return this.error(requestId, 'Malformed request message.')
    }
    return undefined
  }

  private validateRequest(rawUrl: string, rawInit: unknown) {
    const url = new URL(rawUrl, this.origin)
    if (url.origin !== this.origin || url.username || url.password || url.hash) {
      throw new TypeError('Only same-origin Snippets API URLs are allowed.')
    }
    const routeType = collectionPath.test(url.pathname) ? 'collection' : detailPath.test(url.pathname) ? 'detail' : null
    if (!routeType) throw new TypeError('Only /api/snippets routes are allowed.')

    if (rawInit !== undefined && (!isRecord(rawInit) || Object.keys(rawInit).some((key) => !allowedInitKeys.has(key)))) {
      throw new TypeError('fetch init may contain only method, headers, and body.')
    }
    const init = isRecord(rawInit) ? rawInit : {}
    const method = init.method === undefined ? 'GET' : init.method
    if (typeof method !== 'string') throw new TypeError('Request method must be a string.')
    const normalizedMethod = method.toUpperCase()
    if (!methodsByPath.get(routeType)?.has(normalizedMethod)) {
      throw new TypeError('That method is not allowed for this Snippets API route.')
    }

    const headers = normalizeHeaders(init.headers)
    const body = init.body
    if (body !== undefined && body !== null && typeof body !== 'string') {
      throw new TypeError('Request body must be a string or null.')
    }
    if ((normalizedMethod === 'GET' || normalizedMethod === 'DELETE') && body != null) {
      throw new TypeError(`${normalizedMethod} requests cannot include a body.`)
    }
    if (typeof body === 'string' && new TextEncoder().encode(body).byteLength > this.maxBodyBytes) {
      throw new TypeError(`Request body exceeds ${this.maxBodyBytes} bytes.`)
    }
    return { url, method: normalizedMethod, headers, ...(typeof body === 'string' ? { body } : {}) }
  }

  private error(requestId: string, error: string): WorkerResponse {
    return { type: 'response', requestId, error }
  }
}

function normalizeHeaders(value: unknown): Headers {
  if (value === undefined) return new Headers()
  if (!isRecord(value)) throw new TypeError('Headers must be a plain object of string values.')
  const headers = new Headers()
  for (const [name, headerValue] of Object.entries(value)) {
    if (typeof headerValue !== 'string') throw new TypeError('Header values must be strings.')
    if (forbiddenHeaders.has(name.toLowerCase())) throw new TypeError(`The ${name} header is managed by the browser.`)
    headers.set(name, headerValue)
  }
  return headers
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

import { describe, expect, it, vi } from 'vitest'
import { RequestBroker, type WorkerRequest } from './request-broker'

const origin = 'http://localhost:5173'
const snippetId = '2ef06592-b31d-4b72-a0ec-1cf273592e38'

function request(overrides: Partial<WorkerRequest> = {}): WorkerRequest {
  return {
    type: 'request',
    runId: 'run-1',
    requestId: 'request-1',
    url: '/api/snippets',
    ...overrides,
  }
}

describe('RequestBroker', () => {
  it.each([
    ['GET', '/api/snippets'],
    ['GET', `/api/snippets/${snippetId}`],
    ['POST', '/api/snippets'],
    ['PUT', `/api/snippets/${snippetId}`],
    ['PATCH', `/api/snippets/${snippetId}`],
    ['DELETE', `/api/snippets/${snippetId}`],
  ])('forwards allowed %s %s requests', async (method, url) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"data":[]}', { status: 200 }))
    const broker = new RequestBroker({ origin, fetcher })
    broker.startRun('run-1')

    const response = await broker.handle(request({ url, init: { method } }))

    expect(response?.status).toBe(200)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0]?.[0]).toBeInstanceOf(URL)
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method, credentials: 'same-origin', redirect: 'error' })
  })

  it('supports list query parameters and forwards a JSON body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"id":"new"}', { status: 201 }))
    const broker = new RequestBroker({ origin, fetcher })
    broker.startRun('run-1')

    const response = await broker.handle(request({
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"title":"A"}' },
    }))

    expect(response?.status).toBe(201)
    expect(fetcher.mock.calls[0]?.[0]).toBeInstanceOf(URL)
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ body: '{"title":"A"}' })
  })

  it('captures request and response details through the full response body for HTTP errors', async () => {
    const captured: import('./request-broker').NetworkEntry[] = []
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"error":"invalid"}', {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'Content-Type': 'application/json' },
    }))
    const broker = new RequestBroker({ origin, fetcher, onNetworkEntry: (entry) => captured.push(entry) })
    broker.startRun('run-1')

    const response = await broker.handle(request({
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"title":"A"}' },
    }))

    expect(response?.status).toBe(400)
    expect(captured).toHaveLength(2)
    expect(captured[0]).toMatchObject({
      id: 'request-1', method: 'POST', url: `${origin}/api/snippets`,
      requestHeaders: [['content-type', 'application/json']], requestBody: '{"title":"A"}',
    })
    expect(captured[1]).toMatchObject({
      id: 'request-1', status: 400, statusText: 'Bad Request',
      responseHeaders: [['content-type', 'application/json']], responseBody: '{"error":"invalid"}',
    })
    expect(captured[1]?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('emits concurrent request starts in initiation order even when responses finish out of order', async () => {
    const captured: import('./request-broker').NetworkEntry[] = []
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      await new Promise((resolve) => setTimeout(resolve, url.includes('slow') ? 30 : 1))
      return new Response(url.includes('slow') ? 'slow' : 'fast', { status: 200 })
    })
    const broker = new RequestBroker({ origin, fetcher, onNetworkEntry: (entry) => captured.push(entry) })
    broker.startRun('run-1')

    await Promise.all([
      broker.handle(request({ requestId: 'first', url: '/api/snippets?delay=slow' })),
      broker.handle(request({ requestId: 'second', url: '/api/snippets?delay=fast' })),
    ])

    expect(captured.slice(0, 2).map((entry) => entry.id)).toEqual(['first', 'second'])
    expect(captured[2]?.id).toBe('second')
    expect(captured[3]?.id).toBe('first')
    expect(captured[2]?.responseBody).toBe('fast')
    expect(captured[3]?.responseBody).toBe('slow')
  })

  it.each([
    ['external URL', 'https://example.com/api/snippets', undefined],
    ['session route', '/api/session', undefined],
    ['unsupported method', '/api/snippets', { method: 'OPTIONS' }],
    ['collection update', '/api/snippets', { method: 'PATCH' }],
    ['detail creation', `/api/snippets/${snippetId}`, { method: 'POST' }],
    ['unknown init field', '/api/snippets', { credentials: 'include' }],
  ])('rejects %s before network I/O', async (_label, url, init) => {
    const fetcher = vi.fn<typeof fetch>()
    const broker = new RequestBroker({ origin, fetcher })
    broker.startRun('run-1')

    const response = await broker.handle(request({ url, init }))

    expect(response?.error).toBeTruthy()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects malformed broker messages without network I/O', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const broker = new RequestBroker({ origin, fetcher })
    broker.startRun('run-1')

    const response = await broker.handle({ type: 'request', runId: 4, requestId: 'x', url: '/api/snippets' })

    expect(response?.error).toBe('Malformed request message.')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects Request objects, invalid headers, and oversized bodies', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const broker = new RequestBroker({ origin, fetcher, maxBodyBytes: 4 })
    broker.startRun('run-1')

    const requestObject = await broker.handle(request({ url: new Request(`${origin}/api/snippets`) as unknown as string }))
    const badHeaders = await broker.handle(request({ requestId: 'r2', init: { method: 'GET', headers: { Cookie: 'secret' } } }))
    const largeBody = await broker.handle(request({ requestId: 'r3', init: { method: 'POST', body: '12345' } }))

    expect(requestObject?.error).toContain('Malformed request message')
    expect(badHeaders?.error).toContain('managed by the browser')
    expect(largeBody?.error).toContain('exceeds 4 bytes')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('aborts pending requests and rejects new requests when a run stops', async () => {
    let signal: AbortSignal | undefined
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      signal = init?.signal ?? undefined
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const broker = new RequestBroker({ origin, fetcher })
    broker.startRun('run-1')
    const pending = broker.handle(request())
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())

    broker.stopRun('run-1')

    expect(signal?.aborted).toBe(true)
    expect(await pending).toBeUndefined()
    expect((await broker.handle(request({ requestId: 'after-stop' })))?.error).toContain('no longer active')
  })
})

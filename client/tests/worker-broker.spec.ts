import { expect, test } from '@playwright/test'

const policy = "default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'"
const snippetId = '2ef06592-b31d-4b72-a0ec-1cf273592e38'

test('serves the Worker with its restrictive CSP and permits eval while blocking direct access', async ({ page }) => {
  await page.goto('/')
  const actualWorkerResponsePromise = page.waitForResponse((response) => response.url().endsWith('/restlab-worker.js'))
  const workerResponsePromise = page.waitForResponse((response) => response.url().endsWith('/tests/fixtures/worker-security-probe.js'))
  const results = page.evaluate(async () => {
    const apiWorker = new Worker('/restlab-worker.js', { type: 'module' })
    apiWorker.postMessage({ type: 'start', runId: 'policy-check' })
    const worker = new Worker('/tests/fixtures/worker-security-probe.js')
    const received: Record<string, unknown>[] = []
    worker.addEventListener('message', (event) => received.push(event.data))
    worker.postMessage('check')
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        if (['eval', 'nested-worker', 'network'].every((type) => received.some((message) => message.type === type))) {
          clearInterval(timer)
          resolve()
        }
      }, 10)
      setTimeout(() => {
        clearInterval(timer)
        resolve()
      }, 3000)
    })
    apiWorker.terminate()
    worker.terminate()
    return received
  })
  const actualWorkerResponse = await actualWorkerResponsePromise
  const workerResponse = await workerResponsePromise
  expect(actualWorkerResponse.headers()['content-security-policy']).toBe(policy)
  expect(workerResponse.headers()['content-security-policy']).toBe(policy)
  const messages = await results
  expect(messages).toContainEqual({ type: 'eval', value: 42 })
  expect(messages).toContainEqual({ type: 'nested-worker', blocked: true })
  expect(messages).toContainEqual({ type: 'network', allowed: false })
})

test('allows only Snippets API routes and methods through the Worker broker', async ({ page }) => {
  const forwarded: { method: string; path: string; body?: string }[] = []
  await page.route('**/api/snippets**', async (route) => {
    const request = route.request()
    forwarded.push({ method: request.method(), path: new URL(request.url()).pathname, body: request.postData() ?? undefined })
    const status = request.method() === 'POST' ? 201 : request.method() === 'DELETE' ? 204 : 200
    await route.fulfill({ status, body: status === 204 ? '' : '{"data":[]}', contentType: 'application/json' })
  })
  await page.goto('/')

  const result = await page.evaluate(async (id) => {
    const { RequestBroker } = await import('/src/runner/request-broker.ts')
    const broker = new RequestBroker({ origin: location.origin })
    const runId = 'browser-test-run'
    broker.startRun(runId)
    const cases = [
      ['get-list', '/api/snippets', { method: 'GET' }],
      ['get-detail', `/api/snippets/${id}`, { method: 'GET' }],
      ['post', '/api/snippets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }],
      ['put', `/api/snippets/${id}`, { method: 'PUT', body: '{}' }],
      ['patch', `/api/snippets/${id}`, { method: 'PATCH', body: '{}' }],
      ['delete', `/api/snippets/${id}`, { method: 'DELETE' }],
    ] as const
    const handle = (requestId: string, url: string, init?: unknown) => broker.handle({
      type: 'request', runId, requestId, url, ...(init === undefined ? {} : { init }),
    })
    const allowed = await Promise.all(cases.map(([requestId, url, init]) => handle(requestId, url, init)))
    const external = await handle('external', 'https://example.com/api/snippets')
    const appSupport = await handle('support', '/api/session')
    const malformed = await handle('malformed', '/api/snippets', { method: 'POST', credentials: 'include' })
    broker.stopRun(runId)
    return { allowed, external, appSupport, malformed }
  }, snippetId)

  expect(result.allowed.map((response) => response.status)).toEqual([200, 200, 201, 200, 200, 204])
  expect(result.external.error).toContain('same-origin')
  expect(result.appSupport.error).toContain('/api/snippets')
  expect(result.malformed.error).toContain('only method, headers, and body')
  expect(forwarded.map(({ method, path }) => [method, path])).toEqual([
    ['GET', '/api/snippets'],
    ['GET', `/api/snippets/${snippetId}`],
    ['POST', '/api/snippets'],
    ['PUT', `/api/snippets/${snippetId}`],
    ['PATCH', `/api/snippets/${snippetId}`],
    ['DELETE', `/api/snippets/${snippetId}`],
  ])
})


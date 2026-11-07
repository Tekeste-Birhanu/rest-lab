import { afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.ts'
import { hashWorkspaceToken, readWorkspaceToken } from '../src/auth/workspace-cookie.ts'
import { prisma } from '../src/db/prisma.ts'
import { STARTER_API_JS } from '../src/workspaces/starter-data.ts'

const origin = 'http://localhost:5173'
const sessionHashes: string[] = []

function rememberSessionCookie(response: { headers: Record<string, unknown> }): string {
  const header = response.headers['set-cookie']
  const setCookie = Array.isArray(header) ? header[0] : header
  expect(setCookie).toBeTypeOf('string')
  const token = readWorkspaceToken(setCookie as string)
  expect(token).not.toBeNull()
  sessionHashes.push(hashWorkspaceToken(token!))
  return `restlab_workspace=${token}`
}

describe('workspace session endpoints', () => {
  afterAll(async () => {
    if (sessionHashes.length > 0) {
      await prisma.workspace.deleteMany({
        where: { cookieTokenHash: { in: sessionHashes } },
      })
    }
    await prisma.$disconnect()
  })

  it('initializes a workspace, reuses its cookie, and saves source through the UTF-8 byte boundary', async () => {
    const created = await request(app)
      .post('/api/session')
      .set('Origin', origin)
      .expect(201)
    const cookie = rememberSessionCookie(created)
    expect(created.body).toEqual({ apiJs: STARTER_API_JS })
    expect(created.headers['set-cookie'][0]).toContain('HttpOnly')
    expect(created.headers['set-cookie'][0]).toContain('SameSite=Lax')

    const hash = sessionHashes.at(-1)!
    const staleActivity = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    await prisma.workspace.update({
      where: { cookieTokenHash: hash },
      data: { lastActivityAt: staleActivity },
    })
    const firstWorkspace = await prisma.workspace.findUnique({
      where: { cookieTokenHash: hash },
      include: { snippets: true },
    })
    expect(firstWorkspace?.snippets).toHaveLength(3)

    const reused = await request(app)
      .post('/api/session')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .expect(200)
    expect(reused.body).toEqual({ apiJs: STARTER_API_JS })
    expect(readWorkspaceToken(reused.headers['set-cookie'][0])).toBe(readWorkspaceToken(cookie))
    const afterSessionRead = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: hash },
      select: { lastActivityAt: true },
    })
    expect(afterSessionRead.lastActivityAt.getTime()).toBeGreaterThan(staleActivity.getTime())

    await prisma.workspace.update({ where: { cookieTokenHash: hash }, data: { lastActivityAt: staleActivity } })

    const boundarySource = 'x'.repeat(1_000_000)
    const saved = await request(app)
      .put('/api/session/api-js')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send(boundarySource)
      .expect(200)
    expect(saved.body.apiJs).toBe(boundarySource)
    const afterSave = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: hash },
      select: { lastActivityAt: true },
    })
    expect(afterSave.lastActivityAt.getTime()).toBeGreaterThan(staleActivity.getTime())

    const fetched = await request(app)
      .post('/api/session')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .expect(200)
    expect(fetched.body.apiJs).toBe(boundarySource)

    const sourceWithBom = `\uFEFF${'a'.repeat(999_997)}`
    const bomSave = await request(app)
      .put('/api/session/api-js')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send(sourceWithBom)
      .expect(200)
    expect(bomSave.body.apiJs).toBe(sourceWithBom)
  })

  it('rejects oversized, unsupported, malformed, or unauthenticated saves without changing source', async () => {
    const created = await request(app).post('/api/session').set('Origin', origin).expect(201)
    const cookie = rememberSessionCookie(created)
    const tokenHash = sessionHashes.at(-1)!

    const oversized = 'é'.repeat(500_001)
    const tooLarge = await request(app)
      .put('/api/session/api-js')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send(oversized)
      .expect(413)
    expect(tooLarge.body.error.code).toBe('PAYLOAD_TOO_LARGE')

    const unsupported = await request(app)
      .put('/api/session/api-js')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ apiJs: 'not accepted' }))
      .expect(415)
    expect(unsupported.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE')

    await request(app)
      .put('/api/session/api-js')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send(Buffer.from([0xc3, 0x28]))
      .expect(400)

    const unauthenticated = await request(app)
      .put('/api/session/api-js')
      .set('Origin', origin)
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send('no workspace cookie')
      .expect(401)
    expect(unauthenticated.body.error.code).toBe('SESSION_REQUIRED')

    const workspace = await prisma.workspace.findUnique({
      where: { cookieTokenHash: tokenHash },
      select: { apiJs: true },
    })
    expect(workspace?.apiJs).toBe(STARTER_API_JS)
  })

  it('creates a separate workspace for missing or invalid cookies and rejects untrusted origins before mutation', async () => {
    const first = await request(app).post('/api/session').set('Origin', origin).expect(201)
    const firstCookie = rememberSessionCookie(first)
    const second = await request(app)
      .post('/api/session')
      .set('Origin', origin)
      .set('Cookie', 'restlab_workspace=invalid')
      .expect(201)
    const secondCookie = rememberSessionCookie(second)
    expect(readWorkspaceToken(firstCookie)).not.toBe(readWorkspaceToken(secondCookie))

    const missingOrigin = await request(app).post('/api/session').expect(403)
    expect(missingOrigin.body.error.code).toBe('FORBIDDEN')

    const wrongOrigin = await request(app)
      .put('/api/session/api-js')
      .set('Origin', 'https://evil.example')
      .set('Cookie', firstCookie)
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send('must not save')
      .expect(403)
    expect(wrongOrigin.body.error.code).toBe('FORBIDDEN')

    const firstWorkspace = await prisma.workspace.findUnique({
      where: { cookieTokenHash: sessionHashes.at(-2) },
      select: { apiJs: true },
    })
    expect(firstWorkspace?.apiJs).toBe(STARTER_API_JS)
  })
})

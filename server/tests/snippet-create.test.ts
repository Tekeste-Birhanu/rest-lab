import { afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.ts'
import { hashWorkspaceToken, readWorkspaceToken } from '../src/auth/workspace-cookie.ts'
import { prisma } from '../src/db/prisma.ts'

const origin = 'http://localhost:5173'
const workspaceHashes: string[] = []

async function createSession() {
  const response = await request(app).post('/api/session').set('Origin', origin).expect(201)
  const token = readWorkspaceToken(response.headers['set-cookie'][0])
  expect(token).not.toBeNull()
  const tokenHash = hashWorkspaceToken(token!)
  workspaceHashes.push(tokenHash)
  return { cookie: `restlab_workspace=${token}`, tokenHash }
}

describe('Snippets API creation route', () => {
  afterAll(async () => {
    if (workspaceHashes.length > 0) {
      await prisma.workspace.deleteMany({ where: { cookieTokenHash: { in: workspaceHashes } } })
    }
    await prisma.$disconnect()
  })

  it('creates a workspace-owned snippet and returns its server-generated representation', async () => {
    const session = await createSession()
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: session.tokenHash },
      select: { id: true },
    })

    const response = await request(app)
      .post('/api/snippets')
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({
        title: '  Fetch data  ',
        language: '  JavaScript  ',
        code: 'const response = await fetch(\'/api/snippets\');',
      })
      .expect('Content-Type', /json/)
      .expect(201)

    expect(response.body).toMatchObject({
      title: 'Fetch data',
      language: 'JavaScript',
      description: null,
      code: "const response = await fetch('/api/snippets');",
    })
    expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(Number.isNaN(Date.parse(response.body.createdAt))).toBe(false)
    expect(Number.isNaN(Date.parse(response.body.updatedAt))).toBe(false)
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly')

    const stored = await prisma.snippet.findUniqueOrThrow({ where: { id: response.body.id } })
    expect(stored.workspaceId).toBe(workspace.id)
    expect(stored.title).toBe('Fetch data')
  })

  it('rejects invalid input without creating a record', async () => {
    const session = await createSession()
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: session.tokenHash },
      select: { id: true },
    })
    const before = await prisma.snippet.count({ where: { workspaceId: workspace.id } })

    const response = await request(app)
      .post('/api/snippets')
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({ title: '   ', language: 'JavaScript', code: '   ' })
      .expect(400)

    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: expect.arrayContaining([expect.objectContaining({ field: 'title' }), expect.objectContaining({ field: 'code' })]),
    })
    expect(await prisma.snippet.count({ where: { workspaceId: workspace.id } })).toBe(before)
  })

  it('requires JSON, a workspace session, and a trusted origin before creation', async () => {
    const session = await createSession()
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: session.tokenHash },
      select: { id: true },
    })
    const before = await prisma.snippet.count({ where: { workspaceId: workspace.id } })
    const body = { title: 'Create', language: 'JavaScript', code: 'const value = 1;' }

    await request(app).post('/api/snippets').set('Origin', origin).send(body).expect(401)
    await request(app)
      .post('/api/snippets')
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(body))
      .expect(415)
    await request(app)
      .post('/api/snippets')
      .set('Origin', 'https://unexpected.example')
      .set('Cookie', session.cookie)
      .send(body)
      .expect(403)

    expect(await prisma.snippet.count({ where: { workspaceId: workspace.id } })).toBe(before)
  })
})

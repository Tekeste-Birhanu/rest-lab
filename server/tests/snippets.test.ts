import { afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.ts'
import { createWorkspaceToken, hashWorkspaceToken, readWorkspaceToken } from '../src/auth/workspace-cookie.ts'
import { prisma } from '../src/db/prisma.ts'

const origin = 'http://localhost:5173'
const workspaceHashes: string[] = []

async function createSession() {
  const response = await request(app).post('/api/session').set('Origin', origin).expect(201)
  const token = readWorkspaceToken(response.headers['set-cookie'][0])
  expect(token).not.toBeNull()
  workspaceHashes.push(hashWorkspaceToken(token!))
  return { cookie: `restlab_workspace=${token}`, tokenHash: workspaceHashes.at(-1)! }
}

describe('Snippets API read routes', () => {
  afterAll(async () => {
    if (workspaceHashes.length > 0) {
      await prisma.workspace.deleteMany({ where: { cookieTokenHash: { in: workspaceHashes } } })
    }
    await prisma.$disconnect()
  })

  it('lists only the current workspace snippets using the documented default response shape', async () => {
    const first = await createSession()
    const second = await createSession()
    const firstWorkspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: first.tokenHash },
      select: { id: true },
    })
    const secondWorkspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: second.tokenHash },
      select: { id: true },
    })
    const firstSnippetIds = (await prisma.snippet.findMany({
      where: { workspaceId: firstWorkspace.id },
      select: { id: true },
    })).map(({ id }) => id)
    const secondSnippetIds = (await prisma.snippet.findMany({
      where: { workspaceId: secondWorkspace.id },
      select: { id: true },
    })).map(({ id }) => id)

    const firstResponse = await request(app).get('/api/snippets').set('Cookie', first.cookie).expect(200)
    const secondResponse = await request(app).get('/api/snippets').set('Cookie', second.cookie).expect(200)

    expect(firstResponse.body.pagination).toEqual({ limit: 20, offset: 0, total: 3 })
    expect(firstResponse.body.data).toHaveLength(3)
    expect(firstResponse.body.data.map(({ id }: { id: string }) => id).sort()).toEqual(firstSnippetIds.sort())
    expect(secondResponse.body.data.map(({ id }: { id: string }) => id).sort()).toEqual(secondSnippetIds.sort())
    expect(firstSnippetIds).not.toEqual(expect.arrayContaining(secondSnippetIds))
    expect(firstResponse.headers['set-cookie'][0]).toContain('HttpOnly')
    expect(readWorkspaceToken(firstResponse.headers['set-cookie'][0])).toBe(readWorkspaceToken(first.cookie))
  })

  it('retrieves an owned snippet and returns 404 for a snippet owned by another workspace', async () => {
    const first = await createSession()
    const second = await createSession()
    const firstWorkspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: first.tokenHash },
      select: { id: true },
    })
    const secondWorkspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: second.tokenHash },
      select: { id: true },
    })
    const [ownedSnippet] = await prisma.snippet.findMany({ where: { workspaceId: firstWorkspace.id }, take: 1 })
    const [foreignSnippet] = await prisma.snippet.findMany({ where: { workspaceId: secondWorkspace.id }, take: 1 })

    const owned = await request(app)
      .get(`/api/snippets/${ownedSnippet.id}`)
      .set('Cookie', first.cookie)
      .expect(200)
    expect(owned.body).toMatchObject({
      id: ownedSnippet.id,
      title: ownedSnippet.title,
      language: ownedSnippet.language,
      code: ownedSnippet.code,
    })
    expect(owned.body).toHaveProperty('createdAt')
    expect(owned.body).toHaveProperty('updatedAt')

    const foreign = await request(app)
      .get(`/api/snippets/${foreignSnippet.id}`)
      .set('Cookie', first.cookie)
      .expect(404)
    expect(foreign.body.error.code).toBe('SNIPPET_NOT_FOUND')
  })

  it('refreshes activity on list and detail reads, including missing snippet reads', async () => {
    const session = await createSession()
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: session.tokenHash },
      select: { id: true },
    })
    const staleActivity = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    await prisma.workspace.update({ where: { id: workspace.id }, data: { lastActivityAt: staleActivity } })

    const list = await request(app).get('/api/snippets').set('Cookie', session.cookie).expect(200)
    expect(list.body.data).toHaveLength(3)
    let refreshed = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspace.id },
      select: { lastActivityAt: true },
    })
    expect(refreshed.lastActivityAt.getTime()).toBeGreaterThan(staleActivity.getTime())

    await prisma.workspace.update({ where: { id: workspace.id }, data: { lastActivityAt: staleActivity } })
    const snippetId = list.body.data[0].id as string
    await request(app).get(`/api/snippets/${snippetId}`).set('Cookie', session.cookie).expect(200)
    refreshed = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspace.id },
      select: { lastActivityAt: true },
    })
    expect(refreshed.lastActivityAt.getTime()).toBeGreaterThan(staleActivity.getTime())

    await prisma.workspace.update({ where: { id: workspace.id }, data: { lastActivityAt: staleActivity } })
    await request(app).get('/api/snippets/00000000-0000-0000-0000-000000000000').set('Cookie', session.cookie).expect(404)
    refreshed = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspace.id },
      select: { lastActivityAt: true },
    })
    expect(refreshed.lastActivityAt.getTime()).toBeGreaterThan(staleActivity.getTime())
  })

  it('requires an existing workspace session and validates snippet UUIDs', async () => {
    const missingSession = await request(app).get('/api/snippets').expect(401)
    expect(missingSession.body.error.code).toBe('SESSION_REQUIRED')

    const unknownToken = createWorkspaceToken().token
    const unknownSession = await request(app)
      .get('/api/snippets')
      .set('Cookie', `restlab_workspace=${unknownToken}`)
      .expect(401)
    expect(unknownSession.body.error.code).toBe('SESSION_REQUIRED')

    const session = await createSession()
    const invalidId = await request(app)
      .get('/api/snippets/not-a-uuid')
      .set('Cookie', session.cookie)
      .expect(400)
    expect(invalidId.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ field: 'snippetId' }],
    })
  })
})

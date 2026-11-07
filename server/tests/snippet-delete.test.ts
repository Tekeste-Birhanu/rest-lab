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

describe('Snippets API deletion route', () => {
  afterAll(async () => {
    if (workspaceHashes.length > 0) {
      await prisma.workspace.deleteMany({ where: { cookieTokenHash: { in: workspaceHashes } } })
    }
    await prisma.$disconnect()
  })

  it('deletes an owned snippet and returns 204 with no response body', async () => {
    const session = await createSession()
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: session.tokenHash },
      select: { id: true },
    })
    const [snippet] = await prisma.snippet.findMany({ where: { workspaceId: workspace.id }, take: 1 })

    const response = await request(app)
      .delete(`/api/snippets/${snippet.id}`)
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .expect(204)

    expect(response.text).toBe('')
    expect(response.body).toEqual({})
    expect(await prisma.snippet.findUnique({ where: { id: snippet.id } })).toBeNull()
    await request(app)
      .get(`/api/snippets/${snippet.id}`)
      .set('Cookie', session.cookie)
      .expect(404)
  })

  it('returns 404 for missing and other-workspace snippets without deleting foreign records', async () => {
    const owner = await createSession()
    const other = await createSession()
    const ownerWorkspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: owner.tokenHash },
      select: { id: true },
    })
    const otherWorkspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: other.tokenHash },
      select: { id: true },
    })
    const [foreignSnippet] = await prisma.snippet.findMany({ where: { workspaceId: otherWorkspace.id }, take: 1 })
    const foreignBefore = await prisma.snippet.findUniqueOrThrow({ where: { id: foreignSnippet.id } })

    await request(app)
      .delete(`/api/snippets/${foreignSnippet.id}`)
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .expect(404)
    await request(app)
      .delete('/api/snippets/00000000-0000-0000-0000-000000000000')
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .expect(404)
    await request(app)
      .delete('/api/snippets/not-a-uuid')
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .expect(400)

    expect(await prisma.snippet.findUniqueOrThrow({ where: { id: foreignSnippet.id } })).toEqual(foreignBefore)
    expect(await prisma.snippet.count({ where: { workspaceId: ownerWorkspace.id } })).toBe(3)
  })

  it('requires a workspace session and trusted origin before deleting', async () => {
    const session = await createSession()
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: session.tokenHash },
      select: { id: true },
    })
    const [snippet] = await prisma.snippet.findMany({ where: { workspaceId: workspace.id }, take: 1 })

    await request(app)
      .delete(`/api/snippets/${snippet.id}`)
      .set('Origin', origin)
      .expect(401)
    await request(app)
      .delete(`/api/snippets/${snippet.id}`)
      .set('Origin', 'https://unexpected.example')
      .set('Cookie', session.cookie)
      .expect(403)

    expect(await prisma.snippet.findUnique({ where: { id: snippet.id } })).not.toBeNull()
  })
})

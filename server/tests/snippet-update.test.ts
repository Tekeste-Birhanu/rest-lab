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

describe('Snippets API update routes', () => {
  afterAll(async () => {
    if (workspaceHashes.length > 0) {
      await prisma.workspace.deleteMany({ where: { cookieTokenHash: { in: workspaceHashes } } })
    }
    await prisma.$disconnect()
  })

  it('replaces all editable fields with PUT and returns the updated representation', async () => {
    const session = await createSession()
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: session.tokenHash },
      select: { id: true },
    })
    const [original] = await prisma.snippet.findMany({ where: { workspaceId: workspace.id }, take: 1 })

    const response = await request(app)
      .put(`/api/snippets/${original.id}`)
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({ title: '  Replaced  ', language: '  Rust  ', description: null, code: 'fn main() {}' })
      .expect(200)

    expect(response.body).toMatchObject({
      id: original.id,
      title: 'Replaced',
      language: 'Rust',
      description: null,
      code: 'fn main() {}',
    })
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly')
  })

  it('patches only supplied fields and supports clearing description with null', async () => {
    const session = await createSession()
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: session.tokenHash },
      select: { id: true },
    })
    const [original] = await prisma.snippet.findMany({ where: { workspaceId: workspace.id }, take: 1 })

    const titlePatch = await request(app)
      .patch(`/api/snippets/${original.id}`)
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({ title: '  Updated title  ' })
      .expect(200)
    expect(titlePatch.body).toMatchObject({
      id: original.id,
      title: 'Updated title',
      language: original.language,
      description: original.description,
      code: original.code,
    })

    const clearDescription = await request(app)
      .patch(`/api/snippets/${original.id}`)
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({ description: null })
      .expect(200)
    expect(clearDescription.body.description).toBeNull()
    expect(clearDescription.body.code).toBe(original.code)
  })

  it('rejects invalid PUT and PATCH payloads without changing the stored record', async () => {
    const session = await createSession()
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: session.tokenHash },
      select: { id: true },
    })
    const [original] = await prisma.snippet.findMany({ where: { workspaceId: workspace.id }, take: 1 })
    const before = await prisma.snippet.findUniqueOrThrow({ where: { id: original.id } })

    await request(app)
      .put(`/api/snippets/${original.id}`)
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({ title: 'Partial replacement' })
      .expect(400)
    await request(app)
      .patch(`/api/snippets/${original.id}`)
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({ title: 'Would change', code: '   ' })
      .expect(400)
    await request(app)
      .patch(`/api/snippets/${original.id}`)
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({})
      .expect(400)

    const after = await prisma.snippet.findUniqueOrThrow({ where: { id: original.id } })
    expect(after).toEqual(before)
  })

  it('returns 404 for missing or other-workspace snippets without changing foreign records', async () => {
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
    const [ownedSnippet] = await prisma.snippet.findMany({ where: { workspaceId: ownerWorkspace.id }, take: 1 })
    const [foreignSnippet] = await prisma.snippet.findMany({ where: { workspaceId: otherWorkspace.id }, take: 1 })
    const foreignBefore = await prisma.snippet.findUniqueOrThrow({ where: { id: foreignSnippet.id } })
    const replacement = { title: 'Replacement', language: 'JavaScript', description: null, code: 'const x = 1;' }

    await request(app)
      .put(`/api/snippets/${foreignSnippet.id}`)
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send(replacement)
      .expect(404)
    await request(app)
      .patch(`/api/snippets/${foreignSnippet.id}`)
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({ title: 'Attempted change' })
      .expect(404)
    await request(app)
      .patch('/api/snippets/00000000-0000-0000-0000-000000000000')
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({ title: 'Missing' })
      .expect(404)
    await request(app)
      .put('/api/snippets/not-a-uuid')
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send(replacement)
      .expect(400)

    expect(await prisma.snippet.findUniqueOrThrow({ where: { id: foreignSnippet.id } })).toEqual(foreignBefore)
    expect(await prisma.snippet.findUnique({ where: { id: ownedSnippet.id } })).not.toBeNull()
  })
})

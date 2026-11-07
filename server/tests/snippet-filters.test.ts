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

describe('Snippets API list filters', () => {
  afterAll(async () => {
    if (workspaceHashes.length > 0) {
      await prisma.workspace.deleteMany({ where: { cookieTokenHash: { in: workspaceHashes } } })
    }
    await prisma.$disconnect()
  })

  it('searches title and description case-insensitively and combines search with exact language filtering', async () => {
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
    const [titleMatch, descriptionMatch, combinedMatch] = await Promise.all([
      prisma.snippet.create({
        data: {
          workspaceId: firstWorkspace.id,
          title: 'Title NEEDLE-X Alpha',
          language: 'JavaScript',
          description: null,
          code: 'const alpha = true;',
        },
      }),
      prisma.snippet.create({
        data: {
          workspaceId: firstWorkspace.id,
          title: 'Description match beta',
          language: 'Python',
          description: 'A note about Needle-X and description-only-k9.',
          code: 'beta = True',
        },
      }),
      prisma.snippet.create({
        data: {
          workspaceId: firstWorkspace.id,
          title: 'Title needle-x gamma',
          language: 'Python',
          description: null,
          code: 'gamma = True',
        },
      }),
    ])
    const foreignMatch = await prisma.snippet.create({
      data: {
        workspaceId: secondWorkspace.id,
        title: 'Needle-X belongs elsewhere',
        language: 'JavaScript',
        description: null,
        code: 'const foreign = true;',
      },
    })

    const search = await request(app)
      .get('/api/snippets')
      .query({ search: 'nEeDlE-x' })
      .set('Cookie', first.cookie)
      .expect(200)
    const searchIds = search.body.data.map(({ id }: { id: string }) => id)
    expect(searchIds).toHaveLength(3)
    expect(searchIds).toEqual(expect.arrayContaining([titleMatch.id, descriptionMatch.id, combinedMatch.id]))
    expect(searchIds).not.toContain(foreignMatch.id)

    const descriptionSearch = await request(app)
      .get('/api/snippets')
      .query({ search: 'description-only-k9' })
      .set('Cookie', first.cookie)
      .expect(200)
    expect(descriptionSearch.body.data.map(({ id }: { id: string }) => id)).toEqual([descriptionMatch.id])

    const language = await request(app)
      .get('/api/snippets')
      .query({ language: 'pYtHoN' })
      .set('Cookie', first.cookie)
      .expect(200)
    expect(language.body.data.every(({ language: value }: { language: string }) => value.toLowerCase() === 'python')).toBe(true)
    expect(language.body.data.map(({ id }: { id: string }) => id)).toEqual(
      expect.arrayContaining([descriptionMatch.id, combinedMatch.id]),
    )

    const exactLanguage = await request(app)
      .get('/api/snippets')
      .query({ language: 'Java' })
      .set('Cookie', first.cookie)
      .expect(200)
    expect(exactLanguage.body.data).toEqual([])

    const combined = await request(app)
      .get('/api/snippets')
      .query({ search: 'needle-x', language: 'jAvAsCrIpT' })
      .set('Cookie', first.cookie)
      .expect(200)
    expect(combined.body.data.map(({ id }: { id: string }) => id)).toEqual([titleMatch.id])
    expect(combined.body.pagination.total).toBe(1)
  })
})

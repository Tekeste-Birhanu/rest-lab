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

describe('Snippets API sorting and pagination', () => {
  afterAll(async () => {
    if (workspaceHashes.length > 0) {
      await prisma.workspace.deleteMany({ where: { cookieTokenHash: { in: workspaceHashes } } })
    }
    await prisma.$disconnect()
  })

  it('sorts title and language case-insensitively with snippet ID as an ascending tie-breaker', async () => {
    const session = await createSession()
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: session.tokenHash },
      select: { id: true },
    })
    const fixtures = await Promise.all([
      prisma.snippet.create({
        data: {
          workspaceId: workspace.id,
          title: 'Beta sort-fixture-k3',
          language: 'go',
          description: null,
          code: 'package main',
        },
      }),
      prisma.snippet.create({
        data: {
          workspaceId: workspace.id,
          title: 'alpha sort-fixture-k3',
          language: 'javascript',
          description: null,
          code: 'const alpha = 1;',
        },
      }),
      prisma.snippet.create({
        data: {
          workspaceId: workspace.id,
          title: 'Alpha sort-fixture-k3',
          language: 'JavaScript',
          description: null,
          code: 'const Alpha = 2;',
        },
      }),
    ])
    const tiedTitleIds = fixtures
      .filter(({ title }) => title.startsWith('alpha') || title.startsWith('Alpha'))
      .map(({ id }) => id)
      .sort()
    const tiedLanguageIds = fixtures
      .filter(({ language }) => language.toLowerCase() === 'javascript')
      .map(({ id }) => id)
      .sort()

    const titleAscending = await request(app)
      .get('/api/snippets')
      .query({ search: 'sort-fixture-k3', sortBy: 'title', order: 'asc' })
      .set('Cookie', session.cookie)
      .expect(200)
    expect(titleAscending.body.data.map(({ id }: { id: string }) => id)).toEqual([
      ...tiedTitleIds,
      fixtures.find(({ title }) => title.startsWith('Beta'))!.id,
    ])

    const defaultOrder = await request(app)
      .get('/api/snippets')
      .query({ search: 'sort-fixture-k3' })
      .set('Cookie', session.cookie)
      .expect(200)
    expect(defaultOrder.body.data.map(({ id }: { id: string }) => id)).toEqual(
      titleAscending.body.data.map(({ id }: { id: string }) => id),
    )

    const titleDescending = await request(app)
      .get('/api/snippets')
      .query({ search: 'sort-fixture-k3', sortBy: 'title', order: 'desc' })
      .set('Cookie', session.cookie)
      .expect(200)
    expect(titleDescending.body.data.map(({ id }: { id: string }) => id)).toEqual([
      fixtures.find(({ title }) => title.startsWith('Beta'))!.id,
      ...tiedTitleIds,
    ])

    const languageAscending = await request(app)
      .get('/api/snippets')
      .query({ search: 'sort-fixture-k3', sortBy: 'language', order: 'asc' })
      .set('Cookie', session.cookie)
      .expect(200)
    expect(languageAscending.body.data.map(({ id }: { id: string }) => id)).toEqual([
      fixtures.find(({ language }) => language === 'go')!.id,
      ...tiedLanguageIds,
    ])

    const languageDescending = await request(app)
      .get('/api/snippets')
      .query({ search: 'sort-fixture-k3', sortBy: 'language', order: 'desc' })
      .set('Cookie', session.cookie)
      .expect(200)
    expect(languageDescending.body.data.map(({ id }: { id: string }) => id)).toEqual([
      ...tiedLanguageIds,
      fixtures.find(({ language }) => language === 'go')!.id,
    ])
  })

  it('uses documented defaults and paginates after filtering with totals before pagination', async () => {
    const session = await createSession()
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { cookieTokenHash: session.tokenHash },
      select: { id: true },
    })
    await prisma.snippet.createMany({
      data: Array.from({ length: 22 }, (_, index) => ({
        workspaceId: workspace.id,
        title: `Page fixture ${String(index).padStart(2, '0')}`,
        language: 'TestLang',
        description: 'pagination-fixture-r7',
        code: `const page${index} = true;`,
      })),
    })

    const defaults = await request(app).get('/api/snippets').set('Cookie', session.cookie).expect(200)
    expect(defaults.body.pagination).toEqual({ limit: 20, offset: 0, total: 25 })
    expect(defaults.body.data).toHaveLength(20)
    const explicitDefaults = await request(app)
      .get('/api/snippets')
      .query({ sortBy: 'title', order: 'asc', limit: 20, offset: 0 })
      .set('Cookie', session.cookie)
      .expect(200)
    expect(defaults.body.data.map(({ id }: { id: string }) => id)).toEqual(
      explicitDefaults.body.data.map(({ id }: { id: string }) => id),
    )

    const secondPage = await request(app)
      .get('/api/snippets')
      .query({ search: 'pagination-fixture-r7', limit: 100, offset: 20 })
      .set('Cookie', session.cookie)
      .expect(200)
    expect(secondPage.body.pagination).toEqual({ limit: 100, offset: 20, total: 22 })
    expect(secondPage.body.data).toHaveLength(2)
    expect(secondPage.body.data.every(({ description }: { description: string }) => description === 'pagination-fixture-r7')).toBe(true)
  })

  it('rejects invalid, repeated, and unknown list query parameters with field details', async () => {
    const session = await createSession()
    const invalidQueries = [
      ['sortBy=code', 'sortBy'],
      ['order=sideways', 'order'],
      ['limit=0', 'limit'],
      ['limit=101', 'limit'],
      ['limit=1.5', 'limit'],
      ['offset=-1', 'offset'],
      ['offset=9007199254740992', 'offset'],
      ['unknown=value', 'unknown'],
      ['search=one&search=two', 'search'],
    ]

    for (const [query, field] of invalidQueries) {
      const response = await request(app)
        .get(`/api/snippets?${query}`)
        .set('Cookie', session.cookie)
        .expect(400)
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: expect.arrayContaining([expect.objectContaining({ field })]),
      })
    }
  })
})

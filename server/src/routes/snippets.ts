import { Router } from 'express'
import { loadServerConfig } from '../config.ts'
import { prisma } from '../db/prisma.ts'
import { Prisma } from '../generated/prisma/client.ts'
import { ApiValidationError, sendApiError } from '../http/api-error.ts'
import {
  parseCreateSnippetInput,
  parsePatchSnippetInput,
  parseReplaceSnippetInput,
  parseSnippetListQuery,
  parseSnippetId,
} from '../snippets/validation.ts'
import { resolveAndRefreshWorkspace } from '../auth/workspace-access.ts'
import { serializeWorkspaceCookie } from '../auth/workspace-cookie.ts'
import { requireJsonContentType } from '../middleware/require-json-content-type.ts'

const config = loadServerConfig()
export const snippetsRouter = Router()

snippetsRouter.post('/api/snippets', requireJsonContentType, async (request, response) => {
  const workspace = await resolveAndRefreshWorkspace(request.get('cookie'), prisma)
  if (!workspace) {
    sendApiError(response, 401, 'SESSION_REQUIRED', 'Initialize a workspace session before creating snippets.')
    return
  }

  const input = parseCreateSnippetInput(request.body)
  const snippet = await prisma.snippet.create({
    data: { ...input, workspaceId: workspace.id },
  })

  response.setHeader('Set-Cookie', serializeWorkspaceCookie(workspace.token, config.environment))
  response.status(201).json(snippet)
})

snippetsRouter.put('/api/snippets/:snippetId', requireJsonContentType, async (request, response) => {
  const snippetId = parseSnippetId(request.params.snippetId)
  const workspace = await resolveAndRefreshWorkspace(request.get('cookie'), prisma)
  if (!workspace) {
    sendApiError(response, 401, 'SESSION_REQUIRED', 'Initialize a workspace session before updating snippets.')
    return
  }
  response.setHeader('Set-Cookie', serializeWorkspaceCookie(workspace.token, config.environment))

  const existing = await prisma.snippet.findFirst({ where: { id: snippetId, workspaceId: workspace.id } })
  if (!existing) {
    sendApiError(response, 404, 'SNIPPET_NOT_FOUND', 'No snippet with that ID exists in this workspace.')
    return
  }

  const input = parseReplaceSnippetInput(request.body)
  const updated = await prisma.snippet.updateMany({
    where: { id: snippetId, workspaceId: workspace.id },
    data: input,
  })
  if (updated.count === 0) {
    sendApiError(response, 404, 'SNIPPET_NOT_FOUND', 'No snippet with that ID exists in this workspace.')
    return
  }

  const snippet = await prisma.snippet.findFirstOrThrow({ where: { id: snippetId, workspaceId: workspace.id } })
  response.status(200).json(snippet)
})

snippetsRouter.patch('/api/snippets/:snippetId', requireJsonContentType, async (request, response) => {
  const snippetId = parseSnippetId(request.params.snippetId)
  const workspace = await resolveAndRefreshWorkspace(request.get('cookie'), prisma)
  if (!workspace) {
    sendApiError(response, 401, 'SESSION_REQUIRED', 'Initialize a workspace session before updating snippets.')
    return
  }
  response.setHeader('Set-Cookie', serializeWorkspaceCookie(workspace.token, config.environment))

  const existing = await prisma.snippet.findFirst({ where: { id: snippetId, workspaceId: workspace.id } })
  if (!existing) {
    sendApiError(response, 404, 'SNIPPET_NOT_FOUND', 'No snippet with that ID exists in this workspace.')
    return
  }

  const input = parsePatchSnippetInput(request.body)
  const updated = await prisma.snippet.updateMany({
    where: { id: snippetId, workspaceId: workspace.id },
    data: input,
  })
  if (updated.count === 0) {
    sendApiError(response, 404, 'SNIPPET_NOT_FOUND', 'No snippet with that ID exists in this workspace.')
    return
  }

  const snippet = await prisma.snippet.findFirstOrThrow({ where: { id: snippetId, workspaceId: workspace.id } })
  response.status(200).json(snippet)
})

snippetsRouter.delete('/api/snippets/:snippetId', async (request, response) => {
  const snippetId = parseSnippetId(request.params.snippetId)
  const workspace = await resolveAndRefreshWorkspace(request.get('cookie'), prisma)
  if (!workspace) {
    sendApiError(response, 401, 'SESSION_REQUIRED', 'Initialize a workspace session before deleting snippets.')
    return
  }
  response.setHeader('Set-Cookie', serializeWorkspaceCookie(workspace.token, config.environment))

  const deleted = await prisma.snippet.deleteMany({
    where: { id: snippetId, workspaceId: workspace.id },
  })
  if (deleted.count === 0) {
    sendApiError(response, 404, 'SNIPPET_NOT_FOUND', 'No snippet with that ID exists in this workspace.')
    return
  }

  response.status(204).end()
})

snippetsRouter.get('/api/snippets', async (request, response) => {
  const workspace = await resolveAndRefreshWorkspace(request.get('cookie'), prisma)
  if (!workspace) {
    sendApiError(response, 401, 'SESSION_REQUIRED', 'Initialize a workspace session before reading snippets.')
    return
  }

  const query = parseSnippetListQuery(request.query)
  const filters: Prisma.Sql[] = [Prisma.sql`"workspace_id" = ${workspace.id}`]
  if (query.search !== undefined) {
    filters.push(Prisma.sql`(
      strpos(lower("title"), lower(${query.search})) > 0
      OR strpos(lower(coalesce("description", '')), lower(${query.search})) > 0
    )`)
  }
  if (query.language !== undefined) {
    filters.push(Prisma.sql`lower("language") = lower(${query.language})`)
  }

  const where = Prisma.join(filters, ' AND ')
  const sortColumn = Prisma.raw(query.sortBy === 'title' ? '"title"' : '"language"')
  const sortOrder = Prisma.raw(query.order === 'asc' ? 'ASC' : 'DESC')
  const [data, countRows] = await Promise.all([
    prisma.$queryRaw<SnippetListRow[]>(Prisma.sql`
      SELECT
        "id",
        "title",
        "language",
        "description",
        "code",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "snippets"
      WHERE ${where}
      ORDER BY lower(${sortColumn}) ${sortOrder}, "id" ASC
      LIMIT ${query.limit}
      OFFSET ${query.offset}
    `),
    prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS "total"
      FROM "snippets"
      WHERE ${where}
    `),
  ])
  const total = countRows[0].total

  response.setHeader('Set-Cookie', serializeWorkspaceCookie(workspace.token, config.environment))
  response.status(200).json({
    data,
    pagination: { limit: query.limit, offset: query.offset, total },
  })
})

snippetsRouter.get('/api/snippets/:snippetId', async (request, response) => {
  const snippetId = parseSnippetId(request.params.snippetId)
  const workspace = await resolveAndRefreshWorkspace(request.get('cookie'), prisma)
  if (!workspace) {
    sendApiError(response, 401, 'SESSION_REQUIRED', 'Initialize a workspace session before reading snippets.')
    return
  }

  const snippet = await prisma.snippet.findFirst({
    where: { id: snippetId, workspaceId: workspace.id },
  })
  response.setHeader('Set-Cookie', serializeWorkspaceCookie(workspace.token, config.environment))

  if (!snippet) {
    sendApiError(response, 404, 'SNIPPET_NOT_FOUND', 'No snippet with that ID exists in this workspace.')
    return
  }

  response.status(200).json(snippet)
})

interface SnippetListRow {
  id: string
  title: string
  language: string
  description: string | null
  code: string
  createdAt: Date
  updatedAt: Date
}

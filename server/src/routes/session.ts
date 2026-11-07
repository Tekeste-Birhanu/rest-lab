import express, { Router } from 'express'
import { loadServerConfig } from '../config.ts'
import { prisma } from '../db/prisma.ts'
import { sendApiError } from '../http/api-error.ts'
import {
  createWorkspaceToken,
  hashWorkspaceToken,
  readWorkspaceToken,
  serializeWorkspaceCookie,
} from '../auth/workspace-cookie.ts'
import { findOrCreateSeededWorkspace } from '../workspaces/workspace-store.ts'

export const MAX_API_JS_BYTES = 1_000_000

const config = loadServerConfig()
export const sessionRouter = Router()

sessionRouter.post('/api/session', async (request, response) => {
  const token = readWorkspaceToken(request.get('cookie'))
  if (token) {
    const existing = await prisma.workspace.findUnique({
      where: { cookieTokenHash: hashWorkspaceToken(token) },
      select: { apiJs: true },
    })
    if (existing) {
      await prisma.workspace.update({
        where: { cookieTokenHash: hashWorkspaceToken(token) },
        data: { lastActivityAt: new Date() },
      })
      response.setHeader('Set-Cookie', serializeWorkspaceCookie(token, config.environment))
      response.status(200).json({ apiJs: existing.apiJs })
      return
    }
  }

  const { token: newToken, tokenHash } = createWorkspaceToken()
  const { workspace, created } = await findOrCreateSeededWorkspace(prisma, tokenHash)
  response.setHeader('Set-Cookie', serializeWorkspaceCookie(newToken, config.environment))
  response.status(created ? 201 : 200).json({ apiJs: workspace.apiJs })
})

sessionRouter.put(
  '/api/session/api-js',
  (request, response, next) => {
    const contentType = request.get('content-type') ?? ''
    if (!/^text\/plain\s*;\s*charset\s*=\s*(?:"utf-8"|utf-8)\s*$/i.test(contentType)) {
      sendApiError(response, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Use Content-Type: text/plain; charset=utf-8.')
      return
    }
    next()
  },
  express.raw({ type: () => true, limit: MAX_API_JS_BYTES }),
  async (request, response) => {
    const token = readWorkspaceToken(request.get('cookie'))
    if (!token) {
      sendApiError(response, 401, 'SESSION_REQUIRED', 'Initialize a workspace session before saving source.')
      return
    }

    const tokenHash = hashWorkspaceToken(token)
    const workspace = await prisma.workspace.findUnique({
      where: { cookieTokenHash: tokenHash },
      select: { id: true },
    })
    if (!workspace) {
      sendApiError(response, 401, 'SESSION_REQUIRED', 'Initialize a workspace session before saving source.')
      return
    }

    if (!Buffer.isBuffer(request.body)) {
      sendApiError(response, 400, 'BAD_REQUEST', 'The request body must contain UTF-8 source text.')
      return
    }

    let apiJs: string
    try {
      apiJs = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(request.body)
    } catch {
      sendApiError(response, 400, 'BAD_REQUEST', 'The request body must contain valid UTF-8 source text.')
      return
    }

    const saved = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { apiJs, lastActivityAt: new Date() },
      select: { apiJs: true },
    })
    response.setHeader('Set-Cookie', serializeWorkspaceCookie(token, config.environment))
    response.status(200).json({ apiJs: saved.apiJs })
  },
)

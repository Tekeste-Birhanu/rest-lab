import {
  createWorkspaceToken,
  hashWorkspaceToken,
  readWorkspaceToken,
  serializeWorkspaceCookie,
} from './workspace-cookie.ts'
import type { ServerEnvironment } from '../config.ts'

export interface WorkspaceIdentity {
  id: string
}

export interface WorkspaceLookup {
  findByCookieTokenHash(tokenHash: string): Promise<WorkspaceIdentity | null>
}

export interface WorkspaceCreator {
  createWithCookieTokenHash(tokenHash: string): Promise<WorkspaceIdentity>
}

export async function createWorkspaceSession(
  creator: WorkspaceCreator,
  environment: ServerEnvironment,
): Promise<{ workspace: WorkspaceIdentity; setCookie: string }> {
  const { token, tokenHash } = createWorkspaceToken()
  const workspace = await creator.createWithCookieTokenHash(tokenHash)
  return { workspace, setCookie: serializeWorkspaceCookie(token, environment) }
}

export async function resolveWorkspaceCookie(
  cookieHeader: string | undefined,
  lookup: WorkspaceLookup,
): Promise<WorkspaceIdentity | null> {
  const token = readWorkspaceToken(cookieHeader)
  if (!token) return null

  return lookup.findByCookieTokenHash(hashWorkspaceToken(token))
}

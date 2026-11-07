import { createHash, randomBytes } from 'node:crypto'
import type { ServerEnvironment } from '../config.ts'

export const WORKSPACE_COOKIE_NAME = 'restlab_workspace'
export const WORKSPACE_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

const WORKSPACE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export interface WorkspaceToken {
  token: string
  tokenHash: string
}

export function createWorkspaceToken(): WorkspaceToken {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashWorkspaceToken(token) }
}

export function isValidWorkspaceToken(token: string): boolean {
  if (!WORKSPACE_TOKEN_PATTERN.test(token)) return false

  const bytes = Buffer.from(token, 'base64url')
  return bytes.byteLength === 32 && bytes.toString('base64url') === token
}

export function hashWorkspaceToken(token: string): string {
  if (!isValidWorkspaceToken(token)) {
    throw new Error('Invalid workspace token.')
  }

  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function readWorkspaceToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null

  const matches = cookieHeader.split(';').flatMap((part) => {
    const separator = part.indexOf('=')
    if (separator < 0 || part.slice(0, separator).trim() !== WORKSPACE_COOKIE_NAME) return []
    return [part.slice(separator + 1).trim()]
  })

  if (matches.length !== 1 || !isValidWorkspaceToken(matches[0])) return null
  return matches[0]
}

export function serializeWorkspaceCookie(
  token: string,
  environment: ServerEnvironment,
): string {
  if (!isValidWorkspaceToken(token)) {
    throw new Error('Invalid workspace token.')
  }

  const attributes = [
    `${WORKSPACE_COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${WORKSPACE_COOKIE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (environment === 'production') attributes.push('Secure')
  return attributes.join('; ')
}

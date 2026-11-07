import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  createWorkspaceToken,
  hashWorkspaceToken,
  readWorkspaceToken,
  serializeWorkspaceCookie,
  WORKSPACE_COOKIE_MAX_AGE_SECONDS,
  WORKSPACE_COOKIE_NAME,
} from '../src/auth/workspace-cookie.ts'
import {
  createWorkspaceSession,
  resolveWorkspaceCookie,
} from '../src/auth/workspace-resolution.ts'

describe('workspace cookie identity', () => {
  it('persists the token hash and returns the raw token only for the response cookie', async () => {
    const workspace = { id: 'new-workspace' }
    const creator = { createWithCookieTokenHash: vi.fn().mockResolvedValue(workspace) }

    const result = await createWorkspaceSession(creator, 'development')

    expect(result.workspace).toEqual(workspace)
    expect(result.setCookie).toContain(`${WORKSPACE_COOKIE_NAME}=`)
    expect(result.setCookie).toContain('HttpOnly')
    expect(result.setCookie).not.toContain('Secure')
    expect(creator.createWithCookieTokenHash).toHaveBeenCalledOnce()
    const [storedHash] = creator.createWithCookieTokenHash.mock.calls[0]
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/)
    const cookieToken = readWorkspaceToken(result.setCookie)
    expect(cookieToken).not.toBeNull()
    expect(storedHash).not.toBe(cookieToken)
    expect(storedHash).toBe(hashWorkspaceToken(cookieToken!))
  })

  it('creates a 256-bit base64url token and stores only a lowercase SHA-256 digest', () => {
    const { token, tokenHash } = createWorkspaceToken()

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(tokenHash).not.toBe(token)
  })

  it('returns no workspace for a missing cookie without querying storage', async () => {
    const lookup = { findByCookieTokenHash: vi.fn().mockResolvedValue(null) }

    await expect(resolveWorkspaceCookie(undefined, lookup)).resolves.toBeNull()
    expect(lookup.findByCookieTokenHash).not.toHaveBeenCalled()
  })

  it('resolves a valid cookie using only the token hash', async () => {
    const { token } = createWorkspaceToken()
    const workspace = { id: 'workspace-id' }
    const lookup = { findByCookieTokenHash: vi.fn().mockResolvedValue(workspace) }

    await expect(
      resolveWorkspaceCookie(`other=value; ${WORKSPACE_COOKIE_NAME}=${token}`, lookup),
    ).resolves.toEqual(workspace)
    expect(lookup.findByCookieTokenHash).toHaveBeenCalledWith(hashWorkspaceToken(token))
    expect(lookup.findByCookieTokenHash).not.toHaveBeenCalledWith(token)
  })

  it('treats malformed, duplicate, and unknown cookies as unresolved', async () => {
    const { token } = createWorkspaceToken()
    const lookup = { findByCookieTokenHash: vi.fn().mockResolvedValue(null) }

    await expect(resolveWorkspaceCookie(`${WORKSPACE_COOKIE_NAME}=invalid`, lookup)).resolves.toBeNull()
    await expect(
      resolveWorkspaceCookie(`${WORKSPACE_COOKIE_NAME}=${token}; ${WORKSPACE_COOKIE_NAME}=${token}`, lookup),
    ).resolves.toBeNull()
    await expect(resolveWorkspaceCookie(`${WORKSPACE_COOKIE_NAME}=${token}`, lookup)).resolves.toBeNull()
    expect(lookup.findByCookieTokenHash).toHaveBeenCalledTimes(1)
  })

  it('issues a persistent HttpOnly SameSite=Lax cookie, Secure only for HTTPS deployment', () => {
    const { token } = createWorkspaceToken()
    const localCookie = serializeWorkspaceCookie(token, 'development')
    const productionCookie = serializeWorkspaceCookie(token, 'production')

    expect(localCookie).toContain('HttpOnly')
    expect(localCookie).toContain('SameSite=Lax')
    expect(localCookie).toContain(`Max-Age=${WORKSPACE_COOKIE_MAX_AGE_SECONDS}`)
    expect(localCookie).not.toContain('Secure')
    expect(productionCookie).toContain('Secure')
    expect(readWorkspaceToken(`${WORKSPACE_COOKIE_NAME}=${token}`)).toBe(token)
  })
})

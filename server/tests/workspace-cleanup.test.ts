import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceToken } from '../src/auth/workspace-cookie.ts'
import { prisma } from '../src/db/prisma.ts'
import {
  deleteExpiredWorkspaces,
  scheduleWorkspaceCleanup,
  WORKSPACE_INACTIVITY_MS,
} from '../src/workspaces/cleanup.ts'

describe('inactive workspace cleanup', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs independently at UTC midnight and schedules the next daily run', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-07T23:59:59.000Z'))
    const cleanup = vi.fn().mockResolvedValue(undefined)
    const stop = scheduleWorkspaceCleanup(cleanup)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(cleanup).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
    expect(cleanup).toHaveBeenCalledTimes(2)
    stop()
  })

  it('deletes workspaces at the 30-day boundary, cascades snippets, and keeps active workspaces', async () => {
    const now = new Date('2026-11-07T12:00:00.000Z')
    const boundary = new Date(now.getTime() - WORKSPACE_INACTIVITY_MS)
    const expiredHash = createWorkspaceToken().tokenHash
    const boundaryHash = createWorkspaceToken().tokenHash
    const activeHash = createWorkspaceToken().tokenHash
    const hashes = [expiredHash, boundaryHash, activeHash]

    try {
      const expired = await prisma.workspace.create({
        data: { cookieTokenHash: expiredHash, apiJs: 'expired' },
      })
      const onBoundary = await prisma.workspace.create({
        data: { cookieTokenHash: boundaryHash, apiJs: 'boundary' },
      })
      const active = await prisma.workspace.create({
        data: { cookieTokenHash: activeHash, apiJs: 'active' },
      })
      await prisma.workspace.update({
        where: { id: expired.id },
        data: { lastActivityAt: new Date(boundary.getTime() - 1) },
      })
      await prisma.workspace.update({
        where: { id: onBoundary.id },
        data: { lastActivityAt: boundary },
      })
      await prisma.workspace.update({
        where: { id: active.id },
        data: { lastActivityAt: new Date(boundary.getTime() + 1) },
      })
      const expiredSnippet = await prisma.snippet.create({
        data: { workspaceId: onBoundary.id, title: 'Boundary', language: 'text', code: 'sample' },
      })

      const result = await deleteExpiredWorkspaces(prisma, now)

      expect(result.count).toBe(2)
      expect(await prisma.workspace.findUnique({ where: { id: expired.id } })).toBeNull()
      expect(await prisma.workspace.findUnique({ where: { id: onBoundary.id } })).toBeNull()
      expect(await prisma.workspace.findUnique({ where: { id: active.id } })).not.toBeNull()
      expect(await prisma.snippet.findUnique({ where: { id: expiredSnippet.id } })).toBeNull()
    } finally {
      await prisma.workspace.deleteMany({ where: { cookieTokenHash: { in: hashes } } })
    }
  })
})

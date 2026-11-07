import type { PrismaClient } from '../generated/prisma/client.ts'

export const WORKSPACE_INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000

export async function deleteExpiredWorkspaces(
  client: Pick<PrismaClient, 'workspace'>,
  now = new Date(),
) {
  const expiresAt = new Date(now.getTime() - WORKSPACE_INACTIVITY_MS)
  return client.workspace.deleteMany({
    where: { lastActivityAt: { lte: expiresAt } },
  })
}

/** Schedule cleanup for the next UTC midnight and re-arm after each run. */
export function scheduleWorkspaceCleanup(
  cleanup: () => Promise<unknown>,
  onError: (error: unknown) => void = () => {},
) {
  let timer: NodeJS.Timeout | undefined
  let stopped = false

  const scheduleNextRun = () => {
    if (stopped) return
    const now = new Date()
    const nextRun = new Date(now)
    nextRun.setUTCHours(24, 0, 0, 0)
    timer = setTimeout(async () => {
      try {
        await cleanup()
      } catch (error) {
        onError(error)
      } finally {
        scheduleNextRun()
      }
    }, nextRun.getTime() - now.getTime())
    timer.unref()
  }

  scheduleNextRun()
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}

import type { PrismaClient } from '../generated/prisma/client.ts'
import { hashWorkspaceToken, readWorkspaceToken } from './workspace-cookie.ts'

export async function resolveAndRefreshWorkspace(
  cookieHeader: string | undefined,
  client: Pick<PrismaClient, 'workspace'>,
) {
  const token = readWorkspaceToken(cookieHeader)
  if (!token) return null

  const workspace = await client.workspace.findUnique({
    where: { cookieTokenHash: hashWorkspaceToken(token) },
    select: { id: true },
  })
  if (!workspace) return null

  const refreshed = await client.workspace.updateMany({
    where: { id: workspace.id },
    data: { lastActivityAt: new Date() },
  })
  if (refreshed.count !== 1) return null

  return { id: workspace.id, token }
}

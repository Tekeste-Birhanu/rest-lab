import type { PrismaClient } from '../generated/prisma/client.ts'

export function refreshWorkspaceActivity(
  client: Pick<PrismaClient, 'workspace'>,
  workspaceId: string,
  at = new Date(),
) {
  return client.workspace.update({
    where: { id: workspaceId },
    data: { lastActivityAt: at },
    select: { lastActivityAt: true },
  })
}

import type { PrismaClient } from '../generated/prisma/client.ts'
import { Prisma } from '../generated/prisma/client.ts'
import { STARTER_API_JS, STARTER_SNIPPETS } from './starter-data.ts'
import { refreshWorkspaceActivity } from './activity.ts'

export async function findOrCreateSeededWorkspace(
  client: Pick<PrismaClient, 'workspace'>,
  cookieTokenHash: string,
) {
  const where = { cookieTokenHash }
  const select = {
    id: true,
    apiJs: true,
    snippets: {
      select: {
        id: true,
        title: true,
        language: true,
        description: true,
        code: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { title: 'asc' as const },
    },
  }

  const existing = await client.workspace.findUnique({ where, select })
  if (existing) {
    await refreshWorkspaceActivity(client, existing.id)
    return { workspace: existing, created: false }
  }

  try {
    const workspace = await client.workspace.create({
      data: {
        cookieTokenHash,
        apiJs: STARTER_API_JS,
        snippets: { create: STARTER_SNIPPETS.map((snippet) => ({ ...snippet })) },
      },
      select,
    })
    return { workspace, created: true }
  } catch (error) {
    // A concurrent first request with the same cookie may win the unique-key race.
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      throw error
    }
    const winner = await client.workspace.findUnique({ where, select })
    if (winner) {
      await refreshWorkspaceActivity(client, winner.id)
      return { workspace: winner, created: false }
    }
    throw error
  }
}

import { afterAll, describe, expect, it } from 'vitest'
import { createWorkspaceToken } from '../src/auth/workspace-cookie.ts'
import { prisma } from '../src/db/prisma.ts'
import { STARTER_API_JS, STARTER_SNIPPETS } from '../src/workspaces/starter-data.ts'
import { findOrCreateSeededWorkspace } from '../src/workspaces/workspace-store.ts'

describe('seeded workspaces', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates three independent starter snippets and does not reseed an existing workspace', async () => {
    const firstHash = createWorkspaceToken().tokenHash
    const secondHash = createWorkspaceToken().tokenHash
    const createdWorkspaceIds: string[] = []

    try {
      const first = await findOrCreateSeededWorkspace(prisma, firstHash)
      createdWorkspaceIds.push(first.workspace.id)
      const second = await findOrCreateSeededWorkspace(prisma, secondHash)
      createdWorkspaceIds.push(second.workspace.id)

      expect(first.created).toBe(true)
      expect(first.workspace.apiJs).toBe(STARTER_API_JS)
      expect(first.workspace.snippets).toHaveLength(3)
      expect(first.workspace.snippets.map(({ title, language, code }) => ({ title, language, code })))
        .toEqual(expect.arrayContaining(STARTER_SNIPPETS.map(({ title, language, code }) => ({ title, language, code }))))
      expect(second.workspace.snippets).toHaveLength(3)
      expect(first.workspace.id).not.toBe(second.workspace.id)
      expect(first.workspace.snippets.map(({ id }) => id))
        .not.toEqual(second.workspace.snippets.map(({ id }) => id))

      const editedApiJs = 'console.log("keep my edits")'
      await prisma.workspace.update({
        where: { id: first.workspace.id },
        data: { apiJs: editedApiJs },
      })
      const removedSnippetId = first.workspace.snippets[0].id
      await prisma.snippet.delete({ where: { id: removedSnippetId } })

      const reused = await findOrCreateSeededWorkspace(prisma, firstHash)
      expect(reused.created).toBe(false)
      expect(reused.workspace.id).toBe(first.workspace.id)
      expect(reused.workspace.apiJs).toBe(editedApiJs)
      expect(reused.workspace.snippets).toHaveLength(2)
      expect(reused.workspace.snippets.map(({ id }) => id)).not.toContain(removedSnippetId)
    } finally {
      if (createdWorkspaceIds.length > 0) {
        await prisma.workspace.deleteMany({ where: { id: { in: createdWorkspaceIds } } })
      }
    }
  })
})

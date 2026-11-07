import 'dotenv/config'
import { app } from './app.ts'
import { loadServerConfig } from './config.ts'
import { prisma } from './db/prisma.ts'
import { deleteExpiredWorkspaces, scheduleWorkspaceCleanup } from './workspaces/cleanup.ts'

try {
  const config = loadServerConfig()

  scheduleWorkspaceCleanup(
    () => deleteExpiredWorkspaces(prisma),
    () => console.error('RestLab workspace cleanup failed.'),
  )

  app.listen(config.port, () => {
    console.log(`RestLab server listening on port ${config.port}`)
  })
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown configuration error.'
  console.error(`RestLab server configuration error: ${message}`)
  process.exitCode = 1
}

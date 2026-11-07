import express from 'express'
import { loadServerConfig } from './config.ts'
import { healthRouter } from './routes/health.ts'
import { sessionRouter } from './routes/session.ts'
import { snippetsRouter } from './routes/snippets.ts'
import { apiErrorHandler, sendApiError } from './http/api-error.ts'
import { requireTrustedOrigin } from './middleware/require-trusted-origin.ts'

export const app = express()
export const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024

app.use('/api', requireTrustedOrigin(loadServerConfig()))
app.use('/api', express.json({ limit: MAX_JSON_BODY_BYTES }))
app.use(healthRouter)
app.use(sessionRouter)
app.use(snippetsRouter)
app.use('/api', (_request, response) => {
  sendApiError(response, 404, 'ROUTE_NOT_FOUND', 'No API endpoint matches this request.')
})
app.use(apiErrorHandler)

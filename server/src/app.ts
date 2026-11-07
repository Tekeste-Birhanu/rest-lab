import express from 'express'
import { healthRouter } from './routes/health.ts'
import { sessionRouter } from './routes/session.ts'
import { apiErrorHandler } from './http/api-error.ts'

export const app = express()

app.use(healthRouter)
app.use(sessionRouter)
app.use(apiErrorHandler)

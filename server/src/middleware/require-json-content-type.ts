import type { RequestHandler } from 'express'
import { sendApiError } from '../http/api-error.ts'

export const requireJsonContentType: RequestHandler = (request, response, next) => {
  const mediaType = request.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (mediaType !== 'application/json') {
    sendApiError(response, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Use Content-Type: application/json.')
    return
  }
  next()
}

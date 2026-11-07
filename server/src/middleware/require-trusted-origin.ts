import type { RequestHandler } from 'express'
import type { ServerConfig } from '../config.ts'
import { sendApiError } from '../http/api-error.ts'

export function requireTrustedOrigin(config: Pick<ServerConfig, 'appOrigin'>): RequestHandler {
  return (request, response, next) => {
    if (request.get('origin') !== config.appOrigin) {
      sendApiError(response, 403, 'FORBIDDEN', 'The request Origin does not match this application.')
      return
    }
    next()
  }
}

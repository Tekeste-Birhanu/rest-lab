import type { ErrorRequestHandler, Response } from 'express'

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: Array<{ field: string; message: string }>
  }
}

export class ApiValidationError extends Error {
  readonly details: Array<{ field: string; message: string }>

  constructor(details: Array<{ field: string; message: string }>) {
    super('The request contains invalid fields.')
    this.name = 'ApiValidationError'
    this.details = details
  }
}

export function sendApiError(
  response: Response,
  status: number,
  code: string,
  message: string,
  details?: Array<{ field: string; message: string }>,
) {
  const error = details ? { code, message, details } : { code, message }
  return response.status(status).json({ error } satisfies ApiErrorBody)
}

export const apiErrorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ApiValidationError) {
    sendApiError(response, 400, 'VALIDATION_ERROR', error.message, error.details)
    return
  }

  if (isBodyTooLarge(error)) {
    sendApiError(response, 413, 'PAYLOAD_TOO_LARGE', 'The request body exceeds the allowed size.')
    return
  }

  if (isUnsupportedMediaType(error)) {
    sendApiError(response, 415, 'UNSUPPORTED_MEDIA_TYPE', 'The request media type or encoding is not supported.')
    return
  }

  if (isBadRequest(error)) {
    sendApiError(response, 400, 'BAD_REQUEST', 'The request body is invalid.')
    return
  }

  sendApiError(response, 500, 'INTERNAL_ERROR', 'An unexpected server error occurred.')
}

function isBodyTooLarge(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large'
}

function isBadRequest(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    ['entity.parse.failed', 'request.size.invalid', 'request.aborted'].includes(String(error.type))
  ) || (
    typeof error === 'object' && error !== null && 'status' in error && error.status === 400
  )
}

function isUnsupportedMediaType(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    ['encoding.unsupported', 'charset.unsupported'].includes(String(error.type))
  )
}

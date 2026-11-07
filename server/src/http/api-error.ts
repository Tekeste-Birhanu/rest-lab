import type { ErrorRequestHandler, Response } from 'express'

export interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}

export function sendApiError(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
  return response.status(status).json({ error: { code, message } } satisfies ApiErrorBody)
}

export const apiErrorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (isBodyTooLarge(error)) {
    sendApiError(response, 413, 'PAYLOAD_TOO_LARGE', 'The request body exceeds the allowed size.')
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
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 400
}

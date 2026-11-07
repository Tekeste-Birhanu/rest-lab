import { afterAll, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import request from 'supertest'
import { app, MAX_JSON_BODY_BYTES } from '../src/app.ts'
import { apiErrorHandler } from '../src/http/api-error.ts'
import { hashWorkspaceToken, readWorkspaceToken } from '../src/auth/workspace-cookie.ts'
import { prisma } from '../src/db/prisma.ts'
import { requireTrustedOrigin } from '../src/middleware/require-trusted-origin.ts'

const origin = 'http://localhost:5173'
const createdHashes: string[] = []

describe('common API request handling', () => {
  afterAll(async () => {
    if (createdHashes.length > 0) {
      await prisma.workspace.deleteMany({ where: { cookieTokenHash: { in: createdHashes } } })
    }
    await prisma.$disconnect()
  })

  it('accepts a JSON body at 2 MB and returns 413 one byte over', async () => {
    const exactBody = JSON.stringify({ data: 'x'.repeat(MAX_JSON_BODY_BYTES - 11) })
    expect(Buffer.byteLength(exactBody)).toBe(MAX_JSON_BODY_BYTES)

    const accepted = await request(app)
      .post('/api/session')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send(exactBody)
      .expect(201)
    const cookieHeader = accepted.headers['set-cookie'][0] as string
    const token = readWorkspaceToken(cookieHeader)
    expect(token).not.toBeNull()
    createdHashes.push(hashWorkspaceToken(token!))

    const tooLargeBody = JSON.stringify({ data: 'x'.repeat(MAX_JSON_BODY_BYTES - 10) })
    expect(Buffer.byteLength(tooLargeBody)).toBe(MAX_JSON_BODY_BYTES + 1)
    const rejected = await request(app)
      .post('/api/session')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send(tooLargeBody)
      .expect(413)

    expect(rejected.body).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request body exceeds the allowed size.',
      },
    })
  })

  it('returns a structured 400 for malformed JSON without parser details', async () => {
    const response = await request(app)
      .post('/api/session')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400)

    expect(response.body).toEqual({
      error: { code: 'BAD_REQUEST', message: 'The request body is invalid.' },
    })
  })

  it('returns a structured 404 for unknown API paths and methods', async () => {
    const unknownPath = await request(app).get('/api/not-a-route').expect(404)
    expect(unknownPath.body).toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'No API endpoint matches this request.' },
    })

    const unknownMethod = await request(app)
      .post('/api/snippets/not-a-route')
      .set('Origin', origin)
      .expect(404)
    expect(unknownMethod.body.error.code).toBe('ROUTE_NOT_FOUND')
  })

  it('requires the configured Origin on every mutating HTTP method', () => {
    const middleware = requireTrustedOrigin({ appOrigin: origin })

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const next = vi.fn()
      middleware(
        { method, get: vi.fn(() => origin) } as unknown as Request,
        {} as Response,
        next,
      )
      expect(next, `${method} with matching Origin`).toHaveBeenCalledOnce()
    }

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const next = vi.fn()
      const response = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Response
      middleware({ method, get: vi.fn(() => undefined) } as unknown as Request, response, next)
      expect(next, `${method} without Origin`).not.toHaveBeenCalled()
      expect(response.status).toHaveBeenCalledWith(403)
    }
  })

  it('returns a generic 500 without leaking internal error details', () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response
    const internalError = new Error('DATABASE_URL=postgresql://private-secret')

    apiErrorHandler(internalError, {} as Request, response, vi.fn())

    expect(response.status).toHaveBeenCalledWith(500)
    expect(response.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' },
    })
    expect(JSON.stringify(response.json.mock.calls[0])).not.toContain('private-secret')
  })
})

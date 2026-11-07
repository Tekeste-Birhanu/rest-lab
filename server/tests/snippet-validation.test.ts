import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { apiErrorHandler, ApiValidationError } from '../src/http/api-error.ts'
import {
  MAX_SNIPPET_CODE_BYTES,
  parseCreateSnippetInput,
  parsePatchSnippetInput,
  parseReplaceSnippetInput,
  parseSnippetId,
} from '../src/snippets/validation.ts'

const validSnippet = {
  title: '  Fetch an item  ',
  language: '  JavaScript  ',
  description: 'Example description',
  code: 'const item = await fetch("/api/snippets");',
}

describe('snippet input validation', () => {
  it('trims title and language while preserving description and code exactly', () => {
    expect(parseCreateSnippetInput(validSnippet)).toEqual({
      title: 'Fetch an item',
      language: 'JavaScript',
      description: 'Example description',
      code: validSnippet.code,
    })
  })

  it('defaults an omitted create description to null and allows an explicit null', () => {
    const { description: _description, ...withoutDescription } = validSnippet
    expect(parseCreateSnippetInput(withoutDescription).description).toBeNull()
    expect(parseCreateSnippetInput({ ...validSnippet, description: null }).description).toBeNull()
  })

  it('checks character limits after trimming and accepts values at each boundary', () => {
    const parsed = parseCreateSnippetInput({
      title: ` ${'t'.repeat(120)} `,
      language: ` ${'l'.repeat(50)} `,
      description: 'd'.repeat(1_000),
      code: 'x',
    })

    expect(parsed.title).toHaveLength(120)
    expect(parsed.language).toHaveLength(50)
    expect(parsed.description).toHaveLength(1_000)
  })

  it('enforces code size in UTF-8 bytes and preserves the exact code text', () => {
    const exactBoundaryCode = 'é'.repeat(MAX_SNIPPET_CODE_BYTES / 2)
    expect(new TextEncoder().encode(exactBoundaryCode)).toHaveLength(MAX_SNIPPET_CODE_BYTES)
    expect(parseCreateSnippetInput({ ...validSnippet, code: exactBoundaryCode }).code).toBe(exactBoundaryCode)

    expect(() => parseCreateSnippetInput({
      ...validSnippet,
      code: `${exactBoundaryCode}x`,
    })).toThrow(ApiValidationError)
  })

  it('aggregates required, type, blank, excessive, and unknown-field errors', () => {
    try {
      parseCreateSnippetInput({
        title: '  ',
        language: 'l'.repeat(51),
        description: 12,
        code: '\n \t',
        workspaceId: 'client supplied',
      })
      throw new Error('Expected validation to fail.')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiValidationError)
      expect((error as ApiValidationError).details.map(({ field }) => field)).toEqual([
        'workspaceId',
        'title',
        'language',
        'description',
        'code',
      ])
    }
  })

  it('requires every editable field for replacement and validates before yielding update data', () => {
    expect(() => parseReplaceSnippetInput({ title: validSnippet.title })).toThrow(ApiValidationError)

    const invalidReplacement = { ...validSnippet, title: 'Changed title', code: '  ' }
    let persistable: ReturnType<typeof parseReplaceSnippetInput> | undefined
    try {
      persistable = parseReplaceSnippetInput(invalidReplacement)
    } catch (error) {
      expect(error).toBeInstanceOf(ApiValidationError)
    }
    expect(persistable).toBeUndefined()
  })

  it('allows valid partial updates, clears nullable description, and rejects empty or unknown patches', () => {
    expect(parsePatchSnippetInput({ title: '  Renamed  ' })).toEqual({ title: 'Renamed' })
    expect(parsePatchSnippetInput({ description: null })).toEqual({ description: null })
    expect(() => parsePatchSnippetInput({})).toThrow(ApiValidationError)
    expect(() => parsePatchSnippetInput({ tags: [] })).toThrow(ApiValidationError)
  })

  it('validates UUID path values', () => {
    const id = '2ef06592-b31d-4b72-a0ec-1cf273592e38'
    expect(parseSnippetId(id)).toBe(id)
    expect(() => parseSnippetId('not-a-uuid')).toThrow(ApiValidationError)
  })

  it('serializes field validation details using the common 400 error format', () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response
    const error = new ApiValidationError([
      { field: 'title', message: 'Title is required.' },
    ])

    apiErrorHandler(error, {} as Request, response, vi.fn())

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request contains invalid fields.',
        details: [{ field: 'title', message: 'Title is required.' }],
      },
    })
  })
})

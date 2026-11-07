import { ApiValidationError } from '../http/api-error.ts'

export const MAX_SNIPPET_CODE_BYTES = 100 * 1024

export interface SnippetInput {
  title: string
  language: string
  description: string | null
  code: string
}

export type SnippetPatch = Partial<SnippetInput>

export interface SnippetListQuery {
  search?: string
  language?: string
  sortBy: 'title' | 'language'
  order: 'asc' | 'desc'
  limit: number
  offset: number
}

type ValidationDetail = { field: string; message: string }
type ValidationMode = 'create' | 'replace' | 'patch'

const editableFields = ['title', 'language', 'description', 'code'] as const
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseCreateSnippetInput(value: unknown): SnippetInput {
  return parseSnippetInput(value, 'create') as SnippetInput
}

export function parseReplaceSnippetInput(value: unknown): SnippetInput {
  return parseSnippetInput(value, 'replace') as SnippetInput
}

export function parsePatchSnippetInput(value: unknown): SnippetPatch {
  return parseSnippetInput(value, 'patch') as SnippetPatch
}

export function parseSnippetId(value: string | string[]): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new ApiValidationError([{ field: 'snippetId', message: 'Snippet ID must be a UUID.' }])
  }
  return value
}

export function parseSnippetListQuery(value: unknown): SnippetListQuery {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiValidationError([{ field: 'query', message: 'Query parameters must be strings.' }])
  }

  const input = value as Record<string, unknown>
  const allowedFields = ['search', 'language', 'sortBy', 'order', 'limit', 'offset']
  const details: ValidationDetail[] = []
  for (const field of Object.keys(input)) {
    if (!allowedFields.includes(field)) details.push({ field, message: 'Unknown query parameter.' })
  }

  const search = parseOptionalQueryString(input.search, 'search', details)
  const language = parseOptionalQueryString(input.language, 'language', details)
  const sortBy = parseEnum(input.sortBy, 'sortBy', ['title', 'language'] as const, 'title', details)
  const order = parseEnum(input.order, 'order', ['asc', 'desc'] as const, 'asc', details)
  const limit = parseInteger(input.limit, 'limit', 1, 100, 20, details)
  const offset = parseInteger(input.offset, 'offset', 0, Number.MAX_SAFE_INTEGER, 0, details)

  if (details.length > 0) throw new ApiValidationError(details)
  return { search, language, sortBy, order, limit, offset }
}

function parseSnippetInput(value: unknown, mode: ValidationMode): SnippetInput | SnippetPatch {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiValidationError([{ field: 'body', message: 'Request body must be a JSON object.' }])
  }

  const input = value as Record<string, unknown>
  const details: ValidationDetail[] = []
  const allowedKeys = new Set<string>(editableFields)

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) details.push({ field: key, message: 'Unknown field.' })
  }

  if (mode === 'patch' && editableFields.every((field) => !(field in input))) {
    details.push({ field: 'body', message: 'Provide at least one editable field.' })
  }

  const output: SnippetPatch = {}
  const required = (field: typeof editableFields[number]) => mode !== 'patch' && (mode === 'replace' || field !== 'description')

  for (const field of editableFields) {
    const present = Object.prototype.hasOwnProperty.call(input, field)
    if (!present) {
      if (required(field)) details.push({ field, message: `${field} is required.` })
      if (field === 'description' && mode === 'create') output.description = null
      continue
    }

    const raw = input[field]
    if (field === 'description') {
      if (raw === null) {
        output.description = null
      } else if (typeof raw !== 'string') {
        details.push({ field, message: 'Description must be a string or null.' })
      } else if (characterLength(raw) > 1_000) {
        details.push({ field, message: 'Description must be at most 1000 characters.' })
      } else {
        output.description = raw
      }
      continue
    }

    if (typeof raw !== 'string') {
      details.push({ field, message: `${capitalize(field)} must be a string.` })
      continue
    }

    if (field === 'title' || field === 'language') {
      const normalized = raw.trim()
      const maxLength = field === 'title' ? 120 : 50
      if (!normalized) {
        details.push({ field, message: `${capitalize(field)} is required.` })
      } else if (characterLength(normalized) > maxLength) {
        details.push({ field, message: `${capitalize(field)} must be at most ${maxLength} characters.` })
      } else {
        output[field] = normalized
      }
      continue
    }

    if (!raw.trim()) {
      details.push({ field, message: 'Code must contain non-whitespace content.' })
    } else if (new TextEncoder().encode(raw).byteLength > MAX_SNIPPET_CODE_BYTES) {
      details.push({ field, message: 'Code must be at most 100 KB in UTF-8.' })
    } else {
      output.code = raw
    }
  }

  if (details.length > 0) throw new ApiValidationError(details)
  return output
}

function characterLength(value: string): number {
  return Array.from(value).length
}

function capitalize(value: string): string {
  return value[0].toUpperCase() + value.slice(1)
}

function parseOptionalQueryString(value: unknown, field: string, details: ValidationDetail[]): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    details.push({ field, message: `The ${field} query parameter must be provided once as a string.` })
    return undefined
  }
  return value
}

function parseEnum<const T extends readonly string[]>(
  value: unknown,
  field: string,
  allowed: T,
  fallback: T[number],
  details: ValidationDetail[],
): T[number] {
  if (value === undefined) return fallback
  if (typeof value === 'string' && allowed.includes(value as T[number])) return value as T[number]
  details.push({ field, message: `The ${field} query parameter must be one of: ${allowed.join(', ')}.` })
  return fallback
}

function parseInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  fallback: number,
  details: ValidationDetail[],
): number {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    details.push({ field, message: `The ${field} query parameter must be an integer from ${minimum} to ${maximum}.` })
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    details.push({ field, message: `The ${field} query parameter must be an integer from ${minimum} to ${maximum}.` })
    return fallback
  }
  return parsed
}

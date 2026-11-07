export type ServerEnvironment = 'development' | 'test' | 'production'

export interface ServerConfig {
  databaseUrl: string
  appOrigin: string
  port: number
  environment: ServerEnvironment
}

export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const databaseUrl = requiredValue(environment, 'DATABASE_URL')
  let parsedDatabaseUrl: URL
  try {
    parsedDatabaseUrl = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.')
  }
  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol.')
  }

  const appOrigin = requiredValue(environment, 'APP_ORIGIN')
  let parsedAppOrigin: URL
  try {
    parsedAppOrigin = new URL(appOrigin)
  } catch {
    throw new Error('APP_ORIGIN must be a valid HTTP or HTTPS origin.')
  }
  if (
    !['http:', 'https:'].includes(parsedAppOrigin.protocol) ||
    parsedAppOrigin.origin !== appOrigin
  ) {
    throw new Error('APP_ORIGIN must contain only an HTTP or HTTPS origin, without a path.')
  }

  const rawPort = environment.PORT ?? '3001'
  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.')
  }

  const rawNodeEnvironment = environment.NODE_ENV ?? 'development'
  if (!['development', 'test', 'production'].includes(rawNodeEnvironment)) {
    throw new Error('NODE_ENV must be development, test, or production.')
  }
  if (rawNodeEnvironment === 'production' && parsedAppOrigin.protocol !== 'https:') {
    throw new Error('APP_ORIGIN must use HTTPS in production.')
  }

  return {
    databaseUrl,
    appOrigin,
    port,
    environment: rawNodeEnvironment as ServerEnvironment,
  }
}

function requiredValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required.`)
  }
  return value
}

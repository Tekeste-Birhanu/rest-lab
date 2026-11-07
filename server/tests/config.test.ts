import { describe, expect, it } from 'vitest'
import { loadServerConfig } from '../src/config.ts'

const validEnvironment = {
  DATABASE_URL: 'postgresql://restlab_app@localhost:5432/rest_lab?schema=public',
  APP_ORIGIN: 'http://localhost:5173',
}

describe('loadServerConfig', () => {
  it('loads the required configuration and local defaults', () => {
    expect(loadServerConfig(validEnvironment)).toEqual({
      databaseUrl: validEnvironment.DATABASE_URL,
      appOrigin: validEnvironment.APP_ORIGIN,
      port: 3001,
      environment: 'development',
    })
  })

  it('fails clearly when a required setting is missing', () => {
    expect(() => loadServerConfig({ APP_ORIGIN: validEnvironment.APP_ORIGIN }))
      .toThrow('DATABASE_URL is required.')
    expect(() => loadServerConfig({ DATABASE_URL: validEnvironment.DATABASE_URL }))
      .toThrow('APP_ORIGIN is required.')
  })

  it('rejects malformed database URLs and non-origin app URLs', () => {
    expect(() => loadServerConfig({ ...validEnvironment, DATABASE_URL: 'mysql://localhost/db' }))
      .toThrow('DATABASE_URL must use the postgres or postgresql protocol.')
    expect(() => loadServerConfig({ ...validEnvironment, APP_ORIGIN: 'http://localhost:5173/path' }))
      .toThrow('APP_ORIGIN must contain only an HTTP or HTTPS origin, without a path.')
  })

  it('validates the port and runtime environment', () => {
    expect(() => loadServerConfig({ ...validEnvironment, PORT: '0' }))
      .toThrow('PORT must be an integer between 1 and 65535.')
    expect(() => loadServerConfig({ ...validEnvironment, NODE_ENV: 'staging' }))
      .toThrow('NODE_ENV must be development, test, or production.')
  })

  it('requires HTTPS for a production app origin', () => {
    expect(() => loadServerConfig({ ...validEnvironment, NODE_ENV: 'production' }))
      .toThrow('APP_ORIGIN must use HTTPS in production.')
    expect(loadServerConfig({
      ...validEnvironment,
      APP_ORIGIN: 'https://restlab.example',
      NODE_ENV: 'production',
    }).environment).toBe('production')
  })
})

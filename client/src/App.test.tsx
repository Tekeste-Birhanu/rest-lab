import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('Workspace shell', () => {
  it('opens to Workspace with the primary views and Results tabs', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('aria-label="Primary navigation"')
    expect(markup).toContain('aria-current="page">Workspace</button>')
    expect(markup).toContain('Examples</button>')
    expect(markup).toContain('My APIs</button>')
    expect(markup).toContain('api.js')
    expect(markup).toContain('aria-label="Results"')
    expect(markup).toContain('aria-selected="true"')
  })
})

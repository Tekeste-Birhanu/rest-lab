import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('Workspace foundation', () => {
  it('renders the initial Workspace heading and foundation message', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('<main')
    expect(markup).toContain('<h1')
    expect(markup).toContain('Workspace</h1>')
    expect(markup).toContain('The frontend foundation is ready.')
  })
})

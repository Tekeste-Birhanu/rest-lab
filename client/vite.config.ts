import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { WORKER_CSP } from './src/runner/worker-policy.ts'

function serveWorkerCsp(): Plugin {
  const addWorkerPolicy = (request: { url?: string }, response: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    const path = request.url?.split('?')[0]
    if (path === '/restlab-worker.js' || path === '/tests/fixtures/worker-security-probe.js') {
      response.setHeader('Content-Security-Policy', WORKER_CSP)
    }
    next()
  }
  return {
    name: 'restlab-worker-csp',
    configureServer(server) {
      server.middlewares.use(addWorkerPolicy)
    },
    configurePreviewServer(server) {
      server.middlewares.use(addWorkerPolicy)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serveWorkerCsp()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})

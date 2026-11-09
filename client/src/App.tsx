import { lazy, Suspense, useEffect, useState } from 'react'
import { useApiJsRunner } from './runner/useApiJsRunner.ts'
import { useApiJsAutosave } from './useApiJsAutosave.ts'

const CodeEditor = lazy(() => import('./CodeEditor.tsx'))

type Page = 'workspace' | 'examples' | 'apis'
type ResultTab = 'console' | 'network'
type NetworkDetailTab = 'headers' | 'request' | 'response'
type SessionState =
  | { status: 'loading' }
  | { status: 'ready'; source: string }
  | { status: 'error'; message: string }

class SessionInitializationError extends Error {}

let sessionRequest: Promise<string> | undefined

function loadSession(): Promise<string> {
  if (!sessionRequest) {
    sessionRequest = fetch('/api/session', { method: 'POST', credentials: 'same-origin' })
      .then(async (response) => {
        if (response.status === 403) {
          throw new SessionInitializationError(
            'The server rejected this app address. Set APP_ORIGIN to match the address in your browser, then retry.',
          )
        }
        if (!response.ok) {
          throw new SessionInitializationError(
            `The server returned HTTP ${response.status} while loading your workspace. Retry in a moment.`,
          )
        }
        let payload: unknown
        try {
          payload = await response.json()
        } catch {
          throw new SessionInitializationError('The server returned invalid session data. Retry the request.')
        }
        if (
          typeof payload !== 'object' || payload === null ||
          !('apiJs' in payload) || typeof payload.apiJs !== 'string'
        ) {
          throw new SessionInitializationError('The server returned invalid session data. Retry the request.')
        }
        return payload.apiJs
      })
      .catch((error: unknown) => {
        sessionRequest = undefined
        throw error
      })
  }
  return sessionRequest
}

const navigation: { id: Page; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'examples', label: 'Examples' },
  { id: 'apis', label: 'My APIs' },
]

function App() {
  const [page, setPage] = useState<Page>('workspace')
  const [resultTab, setResultTab] = useState<ResultTab>('console')
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null)
  const [networkDetailTab, setNetworkDetailTab] = useState<NetworkDetailTab>('headers')
  const [session, setSession] = useState<SessionState>({ status: 'loading' })
  const [retryCount, setRetryCount] = useState(0)
  const runner = useApiJsRunner()
  const runnerStatus = runner.status
  const runApiJs = runner.run
  const stopRun = runner.stop
  const autosave = useApiJsAutosave(session.status === 'ready' ? session.source : null)

  useEffect(() => {
    let active = true
    void loadSession().then(
      (source) => { if (active) setSession({ status: 'ready', source }) },
      (error: unknown) => {
        if (!active) return
        setSession({
          status: 'error',
          message: error instanceof SessionInitializationError
            ? error.message
            : 'Could not reach the backend. Make sure it is running, then retry.',
        })
      },
    )
    return () => { active = false }
  }, [retryCount])

  useEffect(() => {
    const onRunShortcut = (event: KeyboardEvent) => {
      if (page !== 'workspace' || !(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return
      event.preventDefault()
      if (runnerStatus === 'running') stopRun()
      else if (session.status === 'ready') runApiJs(session.source)
    }
    window.addEventListener('keydown', onRunShortcut)
    return () => window.removeEventListener('keydown', onRunShortcut)
  }, [page, runApiJs, runnerStatus, session, stopRun])

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-name" type="button" onClick={() => setPage('workspace')}>
          Rest<span>Lab</span>
        </button>
        <nav className="primary-nav" aria-label="Primary navigation">
          {navigation.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`nav-link${page === id ? ' is-active' : ''}`}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => setPage(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="local-badge">Local to this browser</div>
      </header>

      <main className="main-content">
        {page === 'workspace' ? (
          <Workspace
            resultTab={resultTab}
            onResultTabChange={setResultTab}
            selectedNetworkId={selectedNetworkId}
            onNetworkSelect={setSelectedNetworkId}
            networkDetailTab={networkDetailTab}
            onNetworkDetailTabChange={setNetworkDetailTab}
            session={session}
            runner={runner}
            saveStatus={autosave.status}
            onSourceChange={(source) => {
              setSession((current) => current.status === 'ready' ? { ...current, source } : current)
              autosave.onSourceChange(source)
            }}
            onRetrySave={autosave.retry}
            onRetry={() => {
              setSession({ status: 'loading' })
              setRetryCount((count) => count + 1)
            }}
          />
        ) : (
          <section className="coming-view" aria-labelledby="view-title">
            <h1 id="view-title">{page === 'examples' ? 'Examples' : 'My APIs'}</h1>
          </section>
        )}
      </main>
    </div>
  )
}

function Workspace({
  resultTab,
  onResultTabChange,
  selectedNetworkId,
  onNetworkSelect,
  networkDetailTab,
  onNetworkDetailTabChange,
  session,
  runner,
  saveStatus,
  onSourceChange,
  onRetrySave,
  onRetry,
}: {
  resultTab: ResultTab
  onResultTabChange: (tab: ResultTab) => void
  selectedNetworkId: string | null
  onNetworkSelect: (id: string) => void
  networkDetailTab: NetworkDetailTab
  onNetworkDetailTabChange: (tab: NetworkDetailTab) => void
  session: SessionState
  runner: ReturnType<typeof useApiJsRunner>
  saveStatus: 'saved' | 'saving' | 'failed'
  onSourceChange: (source: string) => void
  onRetrySave: () => void
  onRetry: () => void
}) {
  return (
    <section className="workspace" aria-label="Workspace">
      <div className="workspace-bar">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <div className="file-title-row">
            <div className="file-label"><span className="file-icon" aria-hidden="true">JS</span><strong>api.js</strong></div>
            {session.status === 'ready' && (
              <div className="save-state">
                <span className={`save-state-label ${saveStatus}`} role="status" aria-live="polite" aria-atomic="true">
                  {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'failed' ? 'Save failed' : 'Saved'}
                </span>
                {saveStatus === 'failed' && (
                  <button className="save-retry" type="button" onClick={onRetrySave}>Retry</button>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          className={`run-button${runner.status === 'running' ? ' is-running' : ''}`}
          type="button"
          disabled={session.status !== 'ready'}
          onClick={() => runner.status === 'running'
            ? runner.stop()
            : session.status === 'ready' && runner.run(session.source)}
          aria-label={runner.status === 'running' ? 'Stop JavaScript run' : 'Run JavaScript (Ctrl+Enter)'}
        >
          <span aria-hidden="true">{runner.status === 'running' ? '■' : '▶'}</span>
          {runner.status === 'running' ? 'Stop' : 'Run'}
          {runner.status !== 'running' && <kbd>Ctrl ↵</kbd>}
        </button>
      </div>

      <div className="work-area">
        <section className="editor-panel" aria-label="JavaScript editor">
          <div className="panel-title"><span>api.js</span><span className="language-label">JavaScript</span></div>
          {session.status === 'loading' && (
            <EditorLoadingSkeleton />
          )}
          {session.status === 'ready' && (
            <Suspense fallback={<EditorLoadingSkeleton />}>
              <CodeEditor value={session.source} onChange={onSourceChange} />
            </Suspense>
          )}
          {session.status === 'error' && (
            <div className="editor-placeholder load-error" role="alert">
              <strong>Couldn’t load your workspace</strong>
              <p>{session.message}</p>
              <button type="button" className="retry-button" onClick={onRetry}>Retry</button>
            </div>
          )}
          <div className="panel-status"><span>JavaScript</span><span>Ln 1, Col 1 · UTF-8</span></div>
        </section>

        <section className="results-panel" aria-label="Results">
          <div className="results-header">
            <strong>Results</strong>
            <div className="result-actions">
              {resultTab === 'console' && (
                <button type="button" onClick={() => void navigator.clipboard.writeText(
                  [runner.startupError, ...runner.entries.map((entry) => entry.text)].filter(Boolean).join('\n'),
                )}>Copy</button>
              )}
              <button type="button" onClick={resultTab === 'console' ? runner.clearConsole : () => {
                runner.clearNetwork()
                onNetworkSelect('')
              }}>Clear</button>
            </div>
          </div>
          <div className="result-tabs" role="tablist" aria-label="Result panels">
            <button
              type="button"
              role="tab"
              id="console-tab"
              aria-selected={resultTab === 'console'}
              aria-controls="results-content"
              className={resultTab === 'console' ? 'is-active' : ''}
              onClick={() => onResultTabChange('console')}
            >Console</button>
            <button
              type="button"
              role="tab"
              id="network-tab"
              aria-selected={resultTab === 'network'}
              aria-controls="results-content"
              className={resultTab === 'network' ? 'is-active' : ''}
              onClick={() => onResultTabChange('network')}
            >Network</button>
          </div>
          <div className="result-content" id="results-content" role="tabpanel" aria-labelledby={`${resultTab}-tab`}>
            {resultTab === 'console' && (runner.startupError || runner.entries.length > 0) ? (
              <div className="console-output" aria-live="polite">
                {runner.startupError && <div className="console-entry error">{runner.startupError}</div>}
                {runner.entries.map((entry) => (
                  <div className={`console-entry ${entry.kind}`} key={entry.id}>{entry.text}</div>
                ))}
              </div>
            ) : resultTab === 'network' && runner.networkEntries.length > 0 ? (
              <div className="network-output">
                <div className="network-list" aria-label="Network requests">
                  {runner.networkEntries.map((entry) => (
                    <button
                      className={`network-row${selectedNetworkId === entry.id ? ' is-selected' : ''}`}
                      key={`${entry.runId}:${entry.id}`}
                      type="button"
                      onClick={() => onNetworkSelect(entry.id)}
                    >
                      <strong>{entry.method}</strong>
                      <span>{entry.url}</span>
                      <span>{entry.status ?? (entry.error ? 'Failed' : 'Pending')}</span>
                      <span>{entry.durationMs === undefined ? '…' : `${Math.round(entry.durationMs)} ms`}</span>
                    </button>
                  ))}
                </div>
                {(() => {
                  const entry = runner.networkEntries.find((item) => item.id === selectedNetworkId) ?? runner.networkEntries[0]
                  return (
                    <div className="network-detail">
                      <div className="network-detail-heading">
                        <strong>{entry.method} {entry.url}</strong>
                        <span>{entry.status ? `${entry.status} ${entry.statusText ?? ''}` : entry.error ?? 'Pending'}</span>
                      </div>
                      <div className="network-detail-tabs" role="tablist" aria-label="Request details">
                        {(['headers', 'request', 'response'] as const).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            role="tab"
                            aria-selected={networkDetailTab === tab}
                            className={networkDetailTab === tab ? 'is-active' : ''}
                            onClick={() => onNetworkDetailTabChange(tab)}
                          >{tab[0].toUpperCase() + tab.slice(1)}</button>
                        ))}
                      </div>
                      {networkDetailTab === 'headers' ? (
                        <div className="header-sections">
                          <HeaderTable title="General" rows={[
                            ['Request URL', entry.url], ['Request Method', entry.method],
                            ['Status Code', entry.status ? `${entry.status} ${entry.statusText ?? ''}` : entry.error ?? 'Pending'],
                            ['Duration', entry.durationMs === undefined ? 'Pending' : `${entry.durationMs.toFixed(1)} ms`],
                          ]} />
                          <HeaderTable title="Request Headers" rows={entry.requestHeaders} />
                          <HeaderTable title="Response Headers" rows={entry.responseHeaders ?? []} />
                        </div>
                      ) : networkDetailTab === 'request' ? (
                        <div className="network-payload">
                          <HeaderTable title="Request Headers" rows={entry.requestHeaders} />
                          <BodyBlock title="Request Body" body={entry.requestBody} />
                        </div>
                      ) : (
                        <div className="network-payload">
                          <HeaderTable title="Response Headers" rows={entry.responseHeaders ?? []} />
                          <BodyBlock title="Response Body" body={entry.responseBody} />
                          {entry.error && <p className="network-error">{entry.error}</p>}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div className="result-empty">
                <span className="empty-icon" aria-hidden="true">{resultTab === 'console' ? '›_' : '⇄'}</span>
                <strong>{resultTab === 'console' ? 'Console is empty' : 'Network is empty'}</strong>
                <p>{resultTab === 'console' ? 'Run api.js to see output.' : 'Run api.js to see requests.'}</p>
              </div>
            )}
          </div>
          <div className="panel-status"><span>{resultTab === 'console' ? `${runner.entries.length + (runner.startupError ? 1 : 0)} output lines` : `${runner.networkEntries.length} requests`}</span><span>{runner.status === 'running' ? 'Running' : '—'}</span></div>
        </section>
      </div>
    </section>
  )
}

function HeaderTable({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className="header-section">
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="detail-muted">No headers</p> : rows.map(([name, value], index) => (
        <div className="header-pair" key={`${name}:${index}`}><span>{name}</span><code>{value}</code></div>
      ))}
    </section>
  )
}

function BodyBlock({ title, body }: { title: string; body?: string }) {
  let formatted = body
  if (body) {
    try { formatted = JSON.stringify(JSON.parse(body), null, 2) } catch { /* Keep non-JSON response text intact. */ }
  }
  return (
    <section className="body-block">
      <h3>{title}</h3>
      {formatted ? <pre>{formatted}</pre> : <p className="detail-muted">No body</p>}
    </section>
  )
}

function EditorLoadingSkeleton() {
  return (
    <div className="editor-placeholder loading-placeholder" aria-label="Loading api.js" aria-busy="true">
      <div className="line-number">1</div>
      <div className="skeleton-lines" aria-hidden="true"><span /><span /><span /></div>
    </div>
  )
}

export default App

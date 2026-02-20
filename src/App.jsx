import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { loadDocs, saveDocs, loadToken, saveToken } from './lib/storage'
import { fetchYamlFromGitHub } from './lib/github'
import DocList from './components/DocList'
import './App.css'

const SwaggerViewer = lazy(() => import('./components/SwaggerViewer'))

const ENV_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || ''

export default function App() {
  const [docs, setDocs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [fetchedYaml, setFetchedYaml] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [token, setToken] = useState(() => loadToken() || ENV_TOKEN)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

  const loadDoc = useCallback(
    async (id) => {
      const doc = docs.find((d) => d.id === id)
      if (!doc) {
        if (selectedId === id) {
          setFetchedYaml(null)
          setError(null)
        }
        return
      }
      setLoading(true)
      setError(null)
      try {
        const authToken = token.trim() || undefined
        const text = await fetchYamlFromGitHub(doc.normalized, authToken)
        if (selectedIdRef.current === id) {
          setFetchedYaml(text)
        }
      } catch (e) {
        if (selectedIdRef.current === id) {
          setError(e instanceof Error ? e.message : 'Failed to fetch')
          setFetchedYaml(null)
        }
      } finally {
        if (selectedIdRef.current === id) {
          setLoading(false)
        }
      }
    },
    [docs, token]
  )

  useEffect(() => {
    const saved = loadDocs()
    setDocs(saved)
    if (saved.length > 0 && !selectedId) {
      setSelectedId(saved[0].id)
    }
    // So token from .env is used: persist to localStorage if we have env token and none saved
    if (ENV_TOKEN && !loadToken()) {
      saveToken(ENV_TOKEN)
      setToken(ENV_TOKEN)
    }
  }, [])

  useEffect(() => {
    if (selectedId && docs.length > 0) {
      loadDoc(selectedId)
    } else {
      setFetchedYaml(null)
      setError(null)
    }
  }, [selectedId, docs, loadDoc])

  const handleSetDocs = (nextDocs) => {
    setDocs(nextDocs)
    saveDocs(nextDocs)
  }

  const handleRefresh = (id) => {
    loadDoc(id)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>API Doc Viewer</h1>
      </header>
      <div className="app-body">
        <aside className="app-sidebar">
          <div className="app-settings">
            <button
              type="button"
              className="app-settings-toggle"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-expanded={settingsOpen}
            >
              {settingsOpen ? 'Hide' : 'Settings'}
            </button>
            {settingsOpen && (
              <div className="app-settings-panel">
                <p className="app-settings-token-status">
                  {token.trim() ? `Token: set (${token.trim().length} chars)` : 'Token: not set — required for private repos'}
                </p>
                <label htmlFor="github-token">
                  GitHub token
                </label>
                <input
                  id="github-token"
                  type="password"
                  placeholder="ghp_… or paste token"
                  value={token}
                  onChange={(e) => {
                    const v = e.target.value
                    setToken(v)
                    saveToken(v)
                  }}
                  autoComplete="off"
                />
                <p className="app-settings-hint">
                  Create at GitHub → Settings → Developer settings → Personal access tokens.
                  Classic: scope <code>repo</code>. Fine-grained: grant <code>Contents: Read</code> for the repo.
                </p>
              </div>
            )}
          </div>
          <DocList
            docs={docs}
            setDocs={handleSetDocs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRefresh={handleRefresh}
          />
        </aside>
        <main className="app-main">
          {loading && (
            <div className="app-status">
              <span className="app-loading">Loading…</span>
            </div>
          )}
          {error && !loading && (
            <div className="app-status app-error">
              <p>{error}</p>
              <button type="button" onClick={() => loadDoc(selectedId)}>
                Retry
              </button>
            </div>
          )}
          {!loading && !error && fetchedYaml && (
            <Suspense fallback={
              <div className="app-status">
                <span className="app-loading">Preparing viewer…</span>
              </div>
            }>
              <SwaggerViewer spec={fetchedYaml} />
            </Suspense>
          )}
          {!loading && !error && !fetchedYaml && docs.length === 0 && (
            <div className="app-status">
              <p>Add a GitHub URL to an OpenAPI/Swagger YAML file to view the API doc.</p>
            </div>
          )}
          {!loading && !error && !fetchedYaml && docs.length > 0 && !selectedId && (
            <div className="app-status">
              <p>Select a doc from the list.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

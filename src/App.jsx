import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import yaml from 'js-yaml'
import { loadDocs, saveDocs, loadToken, saveToken } from './lib/storage'
import { fetchYamlFromGitHub } from './lib/github'
import DocList from './components/DocList'
import './App.css'

/** Extract tag names from OpenAPI/Swagger spec for the sections menu */
function extractTagsFromSpec(spec) {
  if (!spec || typeof spec !== 'object') return []
  const fromTop = Array.isArray(spec.tags)
    ? spec.tags.map((t) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
    : []
  const fromPaths = new Set()
  const paths = spec.paths || {}
  for (const ops of Object.values(paths)) {
    if (!ops || typeof ops !== 'object') continue
    for (const op of Object.values(ops)) {
      if (op && Array.isArray(op.tags)) op.tags.forEach((t) => fromPaths.add(t))
    }
  }
  const order = fromTop.length ? fromTop : [...fromPaths]
  fromPaths.forEach((t) => { if (!order.includes(t)) order.push(t) })
  return order
}

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
  const [apiTags, setApiTags] = useState([])
  const [sectionSearch, setSectionSearch] = useState('')
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

  useEffect(() => {
    if (!fetchedYaml) {
      setApiTags([])
      setSectionSearch('')
      return
    }
    setSectionSearch('')
    try {
      const parsed = typeof fetchedYaml === 'string' ? yaml.load(fetchedYaml) : fetchedYaml
      setApiTags(extractTagsFromSpec(parsed || {}))
    } catch {
      setApiTags([])
    }
  }, [fetchedYaml])

  const scrollToTag = useCallback((tagName) => {
    const id = `operations-tag-${tagName}`
    const el = document.getElementById(id) || document.querySelector(`[data-tag="${tagName}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

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
          {apiTags.length > 0 && (
            <div className="app-tags-menu">
              <h3 className="app-tags-menu-title">Sections</h3>
              <input
                type="search"
                className="app-tags-menu-search"
                placeholder="Search sections…"
                value={sectionSearch}
                onChange={(e) => setSectionSearch(e.target.value)}
                aria-label="Filter sections"
              />
              <ul className="app-tags-menu-list" aria-label="API sections">
                {apiTags
                  .filter((tag) =>
                    tag.toLowerCase().includes(sectionSearch.trim().toLowerCase())
                  )
                  .map((tag) => (
                    <li key={tag}>
                      <button
                        type="button"
                        className="app-tags-menu-item"
                        onClick={() => scrollToTag(tag)}
                      >
                        {tag}
                      </button>
                    </li>
                  ))}
              </ul>
              {sectionSearch.trim() && (
                <p className="app-tags-menu-hint">
                  {apiTags.filter((t) =>
                    t.toLowerCase().includes(sectionSearch.trim().toLowerCase())
                  ).length}{' '}
                  of {apiTags.length} sections
                </p>
              )}
            </div>
          )}
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

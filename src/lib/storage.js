const STORAGE_KEY = 'api-explorer-docs'
const STORAGE_KEY_TOKEN = 'api-explorer-github-token'

/**
 * @typedef {Object} DocEntry
 * @property {string} id
 * @property {string} [name] - User-defined display name
 * @property {string} [label] - Auto-generated fallback (e.g. filename)
 * @property {string} githubUrl
 * @property {{ owner: string, repo: string, branch: string, path: string, key: string }} normalized
 */

/**
 * Read saved doc list from localStorage.
 * @returns {DocEntry[]}
 */
export function loadDocs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Save doc list to localStorage.
 * @param {DocEntry[]} docs
 */
export function saveDocs(docs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
  } catch (e) {
    console.warn('Failed to save docs to localStorage', e)
  }
}

/**
 * Generate a simple unique id for a new doc entry.
 * @returns {string}
 */
export function generateId() {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Load saved GitHub token from localStorage (for private repos and higher rate limits).
 * @returns {string}
 */
export function loadToken() {
  try {
    return localStorage.getItem(STORAGE_KEY_TOKEN) || ''
  } catch {
    return ''
  }
}

/**
 * Save GitHub token to localStorage.
 * @param {string} token
 */
export function saveToken(token) {
  try {
    localStorage.setItem(STORAGE_KEY_TOKEN, token || '')
  } catch (e) {
    console.warn('Failed to save token to localStorage', e)
  }
}

import { useState } from 'react'
import { parseGitHubUrl } from '../lib/github'
import { loadDocs, saveDocs, generateId } from '../lib/storage'

/**
 * @typedef {Object} DocEntry
 * @property {string} id
 * @property {string} [name]
 * @property {string} [label]
 * @property {string} githubUrl
 * @property {{ owner: string, repo: string, branch: string, path: string, key: string }} normalized
 */

function displayName(doc) {
  return doc.name?.trim() || doc.label || doc.normalized.path.split('/').pop() || doc.id
}

/**
 * @param {{
 *   docs: DocEntry[]
 *   setDocs: (docs: DocEntry[]) => void
 *   selectedId: string | null
 *   onSelect: (id: string) => void
 *   onRefresh: (id: string) => void
 * }} props
 */
export default function DocList({ docs, setDocs, selectedId, onSelect, onRefresh }) {
  const [inputUrl, setInputUrl] = useState('')
  const [inputName, setInputName] = useState('')
  const [addError, setAddError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')

  const handleAdd = () => {
    setAddError('')
    const normalized = parseGitHubUrl(inputUrl)
    if (!normalized) {
      setAddError('Invalid GitHub URL. Use a blob or raw URL to a YAML file.')
      return
    }
    const key = normalized.key
    if (docs.some((d) => d.normalized.key === key)) {
      setAddError('This doc is already in the list.')
      return
    }
    const newDoc = {
      id: generateId(),
      name: inputName.trim() || undefined,
      label: normalized.path.split('/').pop() || 'API Doc',
      githubUrl: inputUrl.trim(),
      normalized,
    }
    const next = [...docs, newDoc]
    setDocs(next)
    saveDocs(next)
    setInputUrl('')
    setInputName('')
    onSelect(newDoc.id)
  }

  const handleRename = (id, newName) => {
    const next = docs.map((d) =>
      d.id === id ? { ...d, name: newName.trim() || undefined } : d
    )
    setDocs(next)
    saveDocs(next)
    setEditingId(null)
    setEditingName('')
  }

  const handleRemove = (id) => {
    const next = docs.filter((d) => d.id !== id)
    setDocs(next)
    saveDocs(next)
    if (selectedId === id) {
      onSelect(next[0]?.id ?? null)
    }
  }

  return (
    <div className="doc-list">
      <div className="doc-list-add">
        <input
          type="text"
          placeholder="Name (optional)"
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          className="doc-list-input-name"
          aria-label="Display name"
        />
        <div className="doc-list-add-row">
          <input
            id="doc-list-url"
            type="url"
            placeholder="GitHub blob or raw URL to OpenAPI YAML"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            aria-label="GitHub URL"
          />
          <button type="button" onClick={handleAdd}>
            Add
          </button>
        </div>
      </div>
      {addError && <p className="doc-list-error">{addError}</p>}
      <ul className="doc-list-items">
        {docs.map((doc) => (
          <li key={doc.id} className={selectedId === doc.id ? 'selected' : ''}>
            {editingId === doc.id ? (
              <div className="doc-list-item-rename">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(doc.id, editingName)
                    if (e.key === 'Escape') { setEditingId(null); setEditingName('') }
                  }}
                  placeholder="Display name"
                  autoFocus
                  aria-label="Edit name"
                />
                <button type="button" onClick={() => handleRename(doc.id, editingName)} title="Save">
                  Save
                </button>
                <button type="button" onClick={() => { setEditingId(null); setEditingName('') }} title="Cancel">
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="doc-list-item-label"
                  onClick={() => onSelect(doc.id)}
                >
                  {displayName(doc)}
                </button>
                <div className="doc-list-item-actions">
                  <button type="button" onClick={() => { setEditingId(doc.id); setEditingName(doc.name ?? ''); }} title="Rename">
                    Rename
                  </button>
                  <button type="button" onClick={() => onRefresh(doc.id)} title="Refresh">
                    Refresh
                  </button>
                  <button type="button" onClick={() => handleRemove(doc.id)} title="Remove">
                    Remove
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {docs.length === 0 && (
        <p className="doc-list-empty">No docs yet. Add a GitHub URL above.</p>
      )}
    </div>
  )
}

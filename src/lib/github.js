/**
 * Parse a GitHub blob or raw URL into { owner, repo, branch, path }.
 * Blob: https://github.com/owner/repo/blob/branch/path/to/file.yaml
 * Raw:  https://raw.githubusercontent.com/owner/repo/branch/path/to/file.yaml
 * Strips query string and hash so ?raw=true etc. don't break parsing.
 * @param {string} url
 * @returns {{ owner: string, repo: string, branch: string, path: string, key: string } | null}
 */
export function parseGitHubUrl(url) {
  if (!url || typeof url !== 'string') return null
  let trimmed = url.trim()
  try {
    const u = new URL(trimmed)
    trimmed = u.origin + u.pathname
  } catch {
    // keep trimmed as-is if URL parsing fails
  }

  // Raw URL: https://raw.githubusercontent.com/owner/repo/branch/path/to/file.yaml
  const rawMatch = trimmed.match(
    /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i
  )
  if (rawMatch) {
    const [, owner, repo, branch, path] = rawMatch
    return {
      owner,
      repo,
      branch,
      path: path.replace(/^\//, ''),
      key: `${owner}/${repo}/${branch}/${path}`.replace(/\/+/g, '/'),
    }
  }

  // Blob URL: https://github.com/owner/repo/blob/branch/path/to/file.yaml
  const blobMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i
  )
  if (blobMatch) {
    const [, owner, repo, branch, path] = blobMatch
    return {
      owner,
      repo,
      branch,
      path: path.replace(/^\//, ''),
      key: `${owner}/${repo}/${branch}/${path}`.replace(/\/+/g, '/'),
    }
  }

  return null
}

const GITHUB_API_BASE = 'https://api.github.com'

/** Full commit SHA is 40 hex chars; ref can be branch, tag, or commit. */
function isCommitSha(ref) {
  return /^[0-9a-f]{40}$/i.test(ref)
}

/**
 * Fetch file content via Git Data API (commit → tree → blob). Works when ref is a commit SHA.
 * Throws on auth errors (401/403) or when commit/tree/blob not found so we can show a clear message.
 * @param {{ owner: string, repo: string, path: string }} normalized
 * @param {string} commitSha
 * @param {string} [token]
 * @returns {Promise<string>}
 */
async function fetchBlobByCommit(normalized, commitSha, token) {
  const { owner, repo, path } = normalized
  const headers = { Accept: 'application/vnd.github.v3+json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const commitRes = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits/${commitSha}`,
    { headers }
  )
  if (commitRes.status === 401) {
    throw new Error(
      'Invalid or expired GitHub token. Set a valid token in Settings (sidebar) with the "repo" scope.'
    )
  }
  if (commitRes.status === 403) {
    throw new Error(
      'Access denied. Ensure your token is set in Settings and has the "repo" scope for private repos.'
    )
  }
  if (commitRes.status === 404) {
    throw new Error(
      'Commit not found or no access. Set your token in Settings (sidebar). Classic tokens need "repo" scope; fine-grained tokens need Contents: Read for this repository.'
    )
  }
  if (!commitRes.ok) throw new Error(`GitHub API error: ${commitRes.status}`)

  const commit = await commitRes.json()
  const treeSha = commit.tree?.sha
  if (!treeSha) throw new Error('Commit has no tree.')

  const treeRes = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
    { headers }
  )
  if (treeRes.status === 404) {
    throw new Error('Tree not found.')
  }
  if (!treeRes.ok) throw new Error(`GitHub API error: ${treeRes.status}`)

  const tree = await treeRes.json()
  if (tree.truncated) {
    throw new Error('Repository tree is too large. Try using a branch name in the URL instead of a commit SHA.')
  }
  const entry = tree.tree?.find((e) => e.path === path && e.type === 'blob')
  if (!entry?.sha) {
    throw new Error(`Path "${path}" not found in this commit. Check the file path.`)
  }

  const blobHeaders = { Accept: 'application/vnd.github.raw' }
  if (token) blobHeaders.Authorization = `Bearer ${token}`
  const blobRes = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs/${entry.sha}`,
    { headers: blobHeaders }
  )
  if (!blobRes.ok) throw new Error(`GitHub API error: ${blobRes.status}`)
  return blobRes.text()
}

/**
 * Build GitHub API contents URL for raw file.
 * @param {{ owner: string, repo: string, branch: string, path: string }} normalized
 * @returns {string}
 */
export function buildContentsUrl(normalized) {
  const { owner, repo, path, branch } = normalized
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
}

/**
 * Fetch raw YAML/content from GitHub. Uses Contents API first; if 404 and ref is a commit SHA, falls back to Git Data API.
 * @param {{ owner: string, repo: string, branch: string, path: string }} normalized
 * @param {string} [token] - Optional GitHub token for private repos and higher rate limits
 * @returns {Promise<string>} Raw file body as text
 */
export async function fetchYamlFromGitHub(normalized, token) {
  const url = buildContentsUrl(normalized)
  const headers = { Accept: 'application/vnd.github.raw' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { headers })

  if (res.ok) return res.text()

  if (res.status === 404 && isCommitSha(normalized.branch)) {
    const content = await fetchBlobByCommit(normalized, normalized.branch, token)
    if (content !== null) return content
  }

  if (res.status === 404) {
    const detail = `Requested: ${normalized.owner}/${normalized.repo} @ ${normalized.branch} → ${normalized.path}`
    const hint = token
      ? 'Check that the URL is correct and your token has the "repo" scope (for private repos).'
      : 'If this is a private repo, add a GitHub token in Settings (with "repo" scope).'
    throw new Error(`File not found. ${detail} — ${hint}`)
  }

  if (res.status === 403) {
    const data = await res.json().catch(() => ({}))
    if (data.message && /rate limit/i.test(data.message)) {
      throw new Error('GitHub rate limit exceeded. Try again later or add a token.')
    }
    throw new Error(
      token ? 'Access denied (403). Ensure your token has the "repo" scope.' : 'Access denied. Add a GitHub token in Settings.'
    )
  }
  if (res.status === 401) {
    throw new Error(
      token
        ? 'Invalid or expired GitHub token. Create a new token and update Settings.'
        : 'Unauthorized. For private repos, add a GitHub token in Settings.'
    )
  }
  throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
}

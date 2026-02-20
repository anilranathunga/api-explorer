import { useState, useEffect, memo } from 'react'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'
import './SwaggerViewer.css'

/**
 * Renders OpenAPI/Swagger spec (YAML string or object) in Swagger UI.
 * Defers mount to next frame so the app can paint (clear loading) before heavy render.
 */
function SwaggerViewer({ spec }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!spec) {
      setReady(false)
      return
    }
    setReady(false)
    const id = requestAnimationFrame(() => {
      setReady(true)
    })
    return () => cancelAnimationFrame(id)
  }, [spec])

  if (!spec) return null
  if (!ready) {
    return (
      <div className="swagger-viewer-wrap swagger-viewer-placeholder">
        <span className="app-loading">Rendering API doc…</span>
      </div>
    )
  }
  return (
    <div className="swagger-viewer-wrap">
      <SwaggerUI spec={spec} />
    </div>
  )
}

export default memo(SwaggerViewer)

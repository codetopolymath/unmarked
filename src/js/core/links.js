// The deployed docs site is built into the same Pages artifact, one folder below the app.
const PUBLISHED_DOCS = 'https://codetopolymath.github.io/unmarked/docs/'

// Over https the docs sit beside the app, so the same origin serves them (and a fork finds its own).
// Elsewhere (npm start on http://127.0.0.1, file previews) there is no /docs/, so use the published site.
export function docsUrl(base = location) {
  return base.protocol === 'https:' ? new URL('docs/', base.href).href : PUBLISHED_DOCS
}

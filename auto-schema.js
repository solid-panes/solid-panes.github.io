/**
 * solid-panes auto-schema helper
 *
 * Reads loaded JSON-LD data, looks up its @type in the solid-panes
 * reverse-index, and populates the data's $schema field with the
 * matching solid-schema URL — so the existing LOSOS schema-pane (which
 * triggers off $schema) auto-renders the right form.
 *
 * Pure opt-in. Apps that don't import this get original LOSOS behaviour.
 *
 * Usage (in your app's HTML, before losos/shell.js runs):
 *
 *   <script type="module">
 *     import { autoSchema } from 'https://solid-panes.github.io/auto-schema.js'
 *     await autoSchema()
 *   </script>
 *   <script type="module" src="../../losos/shell.js"></script>
 */

const REGISTRY_URL = 'https://solid-panes.github.io/reverse-index.json'

let _index = null
let _loading = null

async function loadIndex(url) {
  if (_index) return _index
  if (_loading) return _loading
  _loading = fetch(url || REGISTRY_URL)
    .then(async r => {
      if (!r.ok) throw new Error('[solid-panes] reverse-index fetch returned ' + r.status)
      return r.json()
    })
    .then(idx => { _index = idx; _loading = null; return idx })
    .catch(err => {
      console.warn('[solid-panes] failed to load reverse-index (will retry on next call):', err)
      _loading = null
      return {}
    })
  return _loading
}

const isUrnSolid = s => typeof s === 'string' && s.startsWith('urn:solid:')

// Resolve a JSON-LD @type value (string, array, prefixed, or bare) to a
// urn:solid form for lookup. Mirrors urn-solid's resolver convention:
// bare names default to urn:solid: per the LION SHOULD recommendation.
function asUrnSolid(type) {
  if (!type) return null
  if (Array.isArray(type)) {
    for (const t of type) {
      const r = asUrnSolid(t)
      if (r) return r
    }
    return null
  }
  if (isUrnSolid(type)) return type
  // Bare name (no scheme/prefix) → urn:solid:<Name>
  if (!/^[a-z][a-z0-9+.-]*:/i.test(type)) return 'urn:solid:' + type
  return null   // absolute upstream IRI; needs urn-solid resolver, not us
}

/**
 * Walk every JSON-LD data island in the page, look up @type, and add
 * $schema if missing. Idempotent — only writes $schema when not already
 * present.
 *
 * SCOPE: only patches *inline* data islands (script tags whose body is
 * the JSON-LD). For data islands using `<script src="...">`, LOSOS's
 * shell.js fetches the src itself after autoSchema runs and overwrites
 * any patches — so external src files should declare $schema directly
 * in the source file. This is consistent with how schema-pane.js looks
 * for $schema today; autoSchema just removes the need for it on inline
 * data.
 *
 * @param {object} opts - { registryUrl?: string }
 *   registryUrl: override the reverse-index URL (defaults to solid-panes.github.io)
 * @returns {Promise<{patched: number, skipped: number}>}
 */
export async function autoSchema(opts) {
  opts = opts || {}
  const idx = await loadIndex(opts.registryUrl)
  let patched = 0
  let skipped = 0

  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    // Skip src-based islands — LOSOS shell will fetch + overwrite, so any
    // patch we make here would be clobbered. Such files should declare
    // $schema directly in source.
    if (el.hasAttribute('src')) { skipped++; continue }

    let data
    try { data = JSON.parse(el.textContent) }
    catch { skipped++; continue }

    if (data['$schema']) { skipped++; continue }   // respect explicit $schema

    const term = asUrnSolid(data['@type'])
    if (!term) { skipped++; continue }

    const manifestUrl = idx[term]
    if (!manifestUrl) { skipped++; continue }

    // Fetch the manifest to find the schema URL.
    let schemaUrl
    try {
      const baseUrl = opts.registryUrl ? new URL(opts.registryUrl) : new URL(REGISTRY_URL)
      const m = await fetch(new URL(manifestUrl, baseUrl).href).then(r => r.json())
      schemaUrl = m.schema
    } catch (e) {
      console.warn('[solid-panes] manifest fetch failed for', term, e)
      skipped++
      continue
    }
    if (!schemaUrl) { skipped++; continue }

    data['$schema'] = schemaUrl
    el.textContent = JSON.stringify(data, null, 2)
    patched++
  }

  return { patched, skipped }
}

// Convenience: also expose the raw index loader for downstream tools.
export { loadIndex }

/**
 * solid-panes schema-view
 *
 * Read-only counterpart to LOSOS's schema-pane. Consumes the same
 * JSON Schema (via the data's $schema field — populated either by
 * autoSchema or declared inline) and renders a nicely-formatted display
 * instead of an editable form.
 *
 * Drop in alongside schema-pane in your app:
 *
 *   <script type="module" data-pane src="https://losos.org/panes/schema-pane.js"></script>
 *   <script type="module" data-pane src="https://solid-panes.github.io/schema-view.js"></script>
 *
 * Both tabs appear in LOSOS's chrome — Edit on schema-pane, View on schema-view.
 *
 * AGPL-3.0 — part of solid-panes
 */

import { html, render } from 'https://losos.org/losos/html.js'

const _schemaCache = new Map()

async function fetchSchema(url, baseUrl) {
  const resolved = baseUrl ? new URL(url, baseUrl).href : url
  if (_schemaCache.has(resolved)) return _schemaCache.get(resolved)
  const r = await fetch(resolved)
  if (!r.ok) throw new Error('schema fetch returned ' + r.status)
  const s = await r.json()
  _schemaCache.set(resolved, s)
  return s
}

const isImageKey = (k) => /^(img|photo|image|avatar|icon|logo|picture)$/i.test(k)

function renderValue(key, value, prop) {
  if (value == null || value === '') return null
  const fmt = prop && prop.format

  // Image URL — render as <img>
  if (fmt === 'uri' && isImageKey(key)) {
    return html`<img src="${value}" alt="" style="max-width: 240px; max-height: 240px; border-radius: 8px; display: block;" onerror="${function(e) { e.target.style.display = 'none' }}" />`
  }
  // Email
  if (fmt === 'email') {
    return html`<a href="${'mailto:' + value}" style="color: #1a5276;">${value}</a>`
  }
  // URL
  if (fmt === 'uri') {
    return html`<a href="${value}" target="_blank" rel="noopener" style="color: #1a5276;">${value}</a>`
  }
  // Date / date-time — friendly format
  if (fmt === 'date-time' || fmt === 'date') {
    try {
      const d = new Date(value)
      if (!isNaN(d)) return html`<time datetime="${value}">${d.toLocaleString()}</time>`
    } catch {}
    return String(value)
  }
  // Boolean
  if (typeof value === 'boolean') {
    return value ? '\u2713' : '\u2717'
  }
  // Array
  if (Array.isArray(value)) {
    return html`<ul style="margin: 0; padding-left: 1.2em;">
      ${value.map(function(v) {
        if (typeof v === 'string') {
          if (/^https?:\/\//.test(v)) return html`<li><a href="${v}" target="_blank" rel="noopener" style="color: #1a5276;">${v}</a></li>`
          return html`<li>${v}</li>`
        }
        if (v && typeof v === 'object') {
          if (v['@id']) return html`<li><a href="${v['@id']}" style="color: #1a5276;">${v.name || v['@id']}</a></li>`
          return html`<li><code>${JSON.stringify(v)}</code></li>`
        }
        return html`<li>${String(v)}</li>`
      })}
    </ul>`
  }
  // Object — show name/@id if available, else inline JSON
  if (typeof value === 'object') {
    if (value['@id']) return html`<a href="${value['@id']}" style="color: #1a5276;">${value.name || value['@id']}</a>`
    return html`<code style="font-size: 13px; color: #555;">${JSON.stringify(value)}</code>`
  }
  // Multi-line text
  if (typeof value === 'string' && value.length > 100) {
    return html`<div style="white-space: pre-wrap;">${value}</div>`
  }
  return String(value)
}

function pickTitle(data, schema) {
  return data.name || data.title || data.summary || data.label || schema.title || 'Untitled'
}

export default {
  label: 'View',
  icon: '\ud83d\udc41\ufe0f',

  canHandle(subject, store) {
    const node = store.get(subject.value)
    if (!node) return false
    // We need a $schema (so we know what fields to show) — same trigger as schema-pane.
    return !!(node['$schema'] || node['http://json-schema.org/schema#'])
  },

  async render(subject, lionStore, container, rawData) {
    let data = rawData
    if (!data) {
      const dataEl = document.querySelector('script[type="application/ld+json"]')
      try { data = JSON.parse(dataEl.textContent) } catch (e) { return }
    }

    const dataEl = document.querySelector('script[type="application/ld+json"]')
    const src = dataEl ? dataEl.getAttribute('src') : null
    const dataUrl = src ? new URL(src, window.location.href).href : window.location.href

    let schema
    try {
      schema = await fetchSchema(data['$schema'], dataUrl)
    } catch (err) {
      console.warn('[schema-view] failed to load schema:', err)
      render(container, html`<div style="padding: 48px; color: #888; font-family: Inter, sans-serif;">No schema available.</div>`)
      return
    }

    const props = schema.properties || {}
    const title = pickTitle(data, schema)

    const fields = []
    for (const key of Object.keys(props)) {
      if (key.startsWith('@') || key.startsWith('$')) continue
      const prop = props[key]
      const value = data[key]
      const rendered = renderValue(key, value, prop)
      if (rendered == null) continue   // omit empty fields from the view
      const label = prop.title || key
      const desc = prop.description
      fields.push(html`
        <div style="margin-bottom: 24px;">
          <div style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; font-weight: 600;">${label}</div>
          ${rendered}
        </div>
      `)
    }

    render(container, html`
      <div style="padding: 48px 40px 80px; font-family: Inter, -apple-system, sans-serif; max-width: 640px; margin: 0 auto;">
        <h1 style="font-family: Georgia, serif; font-size: 36px; font-weight: 400; font-style: italic; color: #1a1a1a; margin: 0 0 8px 0;">${title}</h1>
        ${schema.description ? html`<p style="font-size: 14px; color: #888; margin: 0 0 32px 0;">${schema.description}</p>` : null}
        ${fields.length > 0 ? fields : html`<p style="color: #888;">No data to display.</p>`}
      </div>
    `)
  }
}

---
name: solid-panes
description: Bridge urn:solid types to LOSOS panes and solid-schema contracts. Use when building or extending a LOSOS app that needs schema-driven Edit/View tabs for data tagged with a urn:solid type, or when adding a new type to the cross-app interop registry.
---

# solid-panes

A pane-and-schema registry for `urn:solid` types. Bridges [LOSOS](https://losos.org/) panes to [solid-schema](https://solid-schema.github.io/) contracts. Lives in the stack at:

```
LION (wire)  →  urn-solid (vocab)  →  solid-schema (contracts)  →  solid-panes (this)  →  LOSOS (runtime)
```

## When to use this skill

- You're building a LOSOS app and want auto-generated Edit and View tabs for a typed data resource.
- The user asks "how do I make my LOSOS app render `urn:solid:X` correctly?"
- The user wants to add support for a new type to the cross-app interop story.
- You see `@type: "Note"` (or any bare type) in JSON-LD data and want to know what schema/pane is canonical.

## Quick-start: one-liner integration in a LOSOS app

Three changes to a LOSOS HTML page:

```html
<!-- 1. Inline the data with @type but no $schema -->
<script type="application/ld+json">
{ "@id": "#this", "@type": "Note", "content": "Hello world" }
</script>

<!-- 2. Declare panes — schema-pane (Edit) and schema-view (View) -->
<script type="module" data-pane src="https://losos.org/panes/schema-pane.js"></script>
<script type="module" data-pane src="https://solid-panes.github.io/schema-view.js"></script>
<script type="module" data-pane src="https://losos.org/panes/source-pane.js"></script>

<div id="losos"></div>

<!-- 3. Boot: auto-schema patches $schema, then shell -->
<script type="module">
  import { autoSchema } from 'https://solid-panes.github.io/auto-schema.js'
  await autoSchema()
  await import('https://losos.org/losos/shell.js')
</script>
```

Result: Edit + View + Source tabs, all schema-driven, zero hand-coded form.

## Resolving a manifest

URL pattern: `https://solid-panes.github.io/<Name>/index.json`. Reverse lookup by urn:solid term:

```
curl -s https://solid-panes.github.io/reverse-index.json
```

Each manifest declares:
- `term`: the `urn:solid:` identifier
- `pane`: pane module URL (typically schema-pane.js for the auto-form, sometimes a bespoke pane like todo-pane.js)
- `schema`: the JSON Schema URL in solid-schema (consumed by both schema-pane and schema-view)
- `label`, `icon`, `status`, etc.

## How auto-schema.js works

`autoSchema()` walks every inline JSON-LD data island, looks up `@type` in the solid-panes reverse-index, fetches the manifest, and patches `$schema` into the data. LOSOS's `schema-pane` (and our `schema-view`) trigger off `$schema` and auto-render.

**Limitation**: only patches *inline* data islands (script tags whose body is the JSON-LD). For external `<script src=...>`, LOSOS shell fetches the src and overwrites — those files should declare `$schema` directly in source.

## How schema-view.js works

Read-only counterpart to LOSOS's schema-pane. Reads the same `$schema`, renders a nicely-formatted display:

- `format: uri` + image-ish key → `<img>`
- `format: email` → `mailto:` link
- `format: uri` → external link
- `format: date-time` → friendly local time
- arrays → `<ul>` with auto-link/object handling
- empty fields hidden (unlike Edit which shows all inputs)

Loaded as a `<script data-pane>` alongside schema-pane. LOSOS's chrome shows both as tabs.

## Adding a new type to the registry

1. **Make sure the term exists in urn-solid.** If not, propose it at https://github.com/urn-solid/urn-solid.github.io/issues first.
2. **Make sure the JSON Schema exists in solid-schema.** If not, write one at `solid-schema.github.io/<Name>/index.json` first (see `SKILL.md` there if it exists).
3. **Write the manifest** at `solid-panes.github.io/<Name>/index.json`:

```json
{
  "term": "urn:solid:NewType",
  "termRegistry": "https://urn-solid.github.io/NewType/",
  "pane": "https://losos.org/panes/schema-pane.js",
  "schema": "https://solid-schema.github.io/NewType/index.json",
  "label": "NewType",
  "icon": "🆕",
  "status": "experimental",
  "added": "YYYY-MM-DD"
}
```

4. `npm run validate && npm run build && git commit && git push`. The new entry appears in `index.json` and `reverse-index.json` automatically.

## Routing to a bespoke pane

Most types use `schema-pane.js` for the generic auto-form. Bespoke panes are warranted when the type needs custom UX — a list view of children, a map for spatial data, a chat thread for conversations. Set `pane` to the bespoke URL in the manifest. Bespoke panes still implement the LOSOS pane interface (`{ label, icon, canHandle, render }`).

Example: collections of tasks (`wf:Tracker`) route to LOSOS's bespoke `todo-pane.js` because a list-with-checkboxes is much better UX than a generic form.

## Demos to copy from

- https://solid-panes.github.io/demo/Note/ — Note via schema-pane
- https://solid-panes.github.io/demo/Person/ — Person via schema-pane
- https://solid-panes.github.io/demo/Vtodo/ — Vtodo (single task) via schema-pane

Each is one HTML file. View source, copy, modify the data island and the script tags.

## Don't

- Don't add a manifest for a type that has no entry in urn-solid yet — the registry chain breaks.
- Don't add a manifest with a `schema` URL pointing at a 404 — it will silently render an empty form.
- Don't override the pane registry with custom URLs unless you've checked the bespoke pane handles the right `canHandle` predicate (LOSOS panes self-select via `canHandle`, not the registry).
- Don't put bespoke pane code in solid-panes — pane *implementations* live in LOSOS or in the app itself; solid-panes only ships *pointers*.

## Reference URLs

- Manifest index: https://solid-panes.github.io/index.json
- Reverse index (`urn:solid:Type` → manifest URL): https://solid-panes.github.io/reverse-index.json
- Corpus (every manifest, JSONL): https://solid-panes.github.io/corpus.jsonl
- Manifest schema: https://solid-panes.github.io/schema/manifest.schema.json
- auto-schema helper: https://solid-panes.github.io/auto-schema.js
- schema-view pane: https://solid-panes.github.io/schema-view.js
- Demos: https://solid-panes.github.io/demo/
- Site: https://solid-panes.github.io/

## Related skills

- `urn-solid` — vocabulary registry. Use when working with the term identifiers themselves.
- `solid-schema` — JSON Schemas per type (if a SKILL.md exists there).
- `losos` — the runtime. See https://losos.org/SKILL.md.

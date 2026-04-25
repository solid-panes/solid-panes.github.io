# solid-panes

A pane-and-schema registry for [urn:solid](https://urn-solid.com/) types — bridges [LOSOS](https://losos.org/) panes to [solid-schema](https://solid-schema.github.io/) contracts.

One manifest per type, mapping a `urn:solid:` identifier to a pane URL plus an optional schema URL. LOSOS apps that opt in get auto-form rendering for any data tagged with a known type — no per-file `$schema` declaration needed.

## What's in a manifest

```json
{
  "term": "urn:solid:Note",
  "termRegistry": "https://urn-solid.com/Note/",
  "pane": "https://losos.org/panes/schema-pane.js",
  "schema": "https://solid-schema.github.io/Note/index.json",
  "label": "Note",
  "icon": "📝",
  "status": "stable",
  "added": "2026-04-19"
}
```

That's it — it's a pointer registry, not an implementation registry. The actual pane code lives in LOSOS (or wherever the `pane` URL points). The actual schema lives in solid-schema. solid-panes just wires the two together by `urn:solid:` type.

## How a LOSOS app opts in

One line in the app's HTML, before `shell.js` boots:

```html
<script type="module">
  import { autoSchema } from 'https://solid-panes.github.io/auto-schema.js'
  await autoSchema()
</script>
<script type="module" src="../../losos/shell.js"></script>
```

That's it. `autoSchema()` walks every JSON-LD data island in the page, looks up `@type` in the solid-panes reverse-index, and populates `$schema` with the matching solid-schema URL. The existing LOSOS schema-pane then triggers off `$schema` and auto-renders the form — no LOSOS changes required.

Apps that don't import the helper get exactly the LOSOS behaviour they had before.

## Repo layout

```
<Name>/index.json    Source — pane+schema manifest for one urn:solid type
<Name>/index.html    Generated wrapper page
schema/manifest.schema.json   Meta-schema enforcing manifest shape
scripts/validate.js  Validate every manifest
scripts/build.js     Generate HTML wrappers, index.json, reverse-index.json, corpus.jsonl
auto-schema.js       Opt-in helper for LOSOS apps
index.json           Generated: type → manifest summary
reverse-index.json   Generated: urn:solid:Type → manifest URL
corpus.jsonl         Generated: every manifest, one per line
```

## Stack position

```
┌──────────────────────────────────┐
│  LION                            │  wire format (just JSON)
├──────────────────────────────────┤
│  urn-solid                       │  vocabulary (term names + owl:sameAs)
├──────────────────────────────────┤
│  solid-schema                    │  contracts (per-type JSON Schemas)
├──────────────────────────────────┤
│  solid-panes (this repo)         │  manifests (urn:solid type → pane + schema)
├──────────────────────────────────┤
│  LOSOS                           │  runtime (panes consume schemas)
└──────────────────────────────────┘
```

Each layer is independently consumable. solid-panes is *configuration only* — it never ships pane code or schema code. It just points.

## Adding a new entry

```bash
mkdir Profile
# write Profile/index.json with { term, pane, schema, label, status, added }
npm run validate
npm run build
git commit -am "add Profile manifest"
```

## License

[AGPL-3.0](LICENSE)

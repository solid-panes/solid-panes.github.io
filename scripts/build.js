#!/usr/bin/env node
// Build step:
//   - per-type HTML wrappers
//   - index.json (Name → manifest)
//   - reverse-index.json (urn:solid:Type → manifest URL — including alsoHandles)
//   - corpus.jsonl
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");

const RESERVED = new Set([
  "schema", "scripts", "node_modules", ".github", ".git", ".claude",
  "assets", "vendor", "spec", "demo"
]);

const isTypeDir = (name) => {
  if (RESERVED.has(name)) return false;
  if (name.startsWith(".")) return false;
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) return false;
  return fs.existsSync(path.join(ROOT, name, "index.json"));
};

const writeIfChanged = (file, content) => {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return false;
  fs.writeFileSync(file, content);
  return true;
};

const escapeForScriptTag = (json) => json.replace(/<\/script/gi, "<\\/script");

const htmlShell = (manifest, jsonText, name) => {
  const label = manifest.label || name;
  const desc = (manifest.description || "").replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${label} — solid-panes</title>
<meta name="description" content="${desc}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="/${name}/">
<link rel="alternate" type="application/json" href="/${name}/index.json">
<script type="application/json">
${escapeForScriptTag(jsonText)}
</script>
<style>
body { font-family: Georgia, serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #2c2c2c; background: #fafaf8; }
header a { color: #888; text-decoration: none; margin-right: 1.2rem; }
h1 { margin-bottom: 0.25rem; }
.subtitle { color: #888; margin-top: 0; }
.urn { font-family: monospace; background: #f0efeb; padding: 0.1em 0.4em; border-radius: 3px; }
pre { background: #f0efeb; padding: 1rem; overflow-x: auto; border-radius: 4px; }
table { border-collapse: collapse; margin: 1rem 0; }
td { padding: 4px 12px 4px 0; vertical-align: top; }
td:first-child { color: #888; }
</style>
</head>
<body>
<header>
  <a href="/">solid-panes</a>
  <a href="/index.json">index</a>
  <a href="/reverse-index.json">reverse</a>
  <a href="/corpus.jsonl">corpus</a>
</header>
<main>
  <h1>${manifest.icon || ""} ${label}</h1>
  <p class="subtitle">${desc}</p>
  <table>
    <tr><td>Term</td><td><a class="urn" href="${manifest.termRegistry || "#"}">${manifest.term}</a></td></tr>
    <tr><td>Pane</td><td><a href="${manifest.pane}">${manifest.pane}</a></td></tr>
    ${manifest.schema ? `<tr><td>Schema</td><td><a href="${manifest.schema}">${manifest.schema}</a></td></tr>` : ""}
    <tr><td>Status</td><td>${manifest.status}</td></tr>
  </table>
  <h2>Manifest</h2>
  <pre><code>${jsonText.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>
</main>
</body>
</html>
`;
};

const assertNoCaseCollisions = (names) => {
  const lower = new Map();
  for (const n of names) {
    const key = n.toLowerCase();
    if (lower.has(key) && lower.get(key) !== n) {
      throw new Error(`Case collision: "${lower.get(key)}" and "${n}" differ only in case.`);
    }
    lower.set(key, n);
  }
};

const main = () => {
  const names = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(isTypeDir)
    .sort();

  assertNoCaseCollisions(names);

  const index = {};
  const reverseIndex = {};
  const corpusLines = [];
  let htmlChanged = 0;

  for (const name of names) {
    const srcPath = path.join(ROOT, name, "index.json");
    const jsonText = fs.readFileSync(srcPath, "utf8");
    let manifest;
    try { manifest = JSON.parse(jsonText); }
    catch (e) { console.error(`[build] ${srcPath}: malformed JSON — ${e.message}`); process.exit(1); }

    if (writeIfChanged(path.join(ROOT, name, "index.html"), htmlShell(manifest, jsonText, name))) htmlChanged++;

    const manifestUrl = `/${name}/index.json`;
    index[name] = {
      term: manifest.term,
      label: manifest.label,
      pane: manifest.pane,
      schema: manifest.schema,
      status: manifest.status,
      manifest: manifestUrl
    };

    if (reverseIndex[manifest.term] && reverseIndex[manifest.term] !== manifestUrl) {
      console.error(`[build] duplicate term ${manifest.term} — already mapped to ${reverseIndex[manifest.term]}, also claimed by ${manifestUrl}`);
      process.exit(1);
    }
    reverseIndex[manifest.term] = manifestUrl;

    if (Array.isArray(manifest.alsoHandles)) {
      for (const t of manifest.alsoHandles) {
        if (reverseIndex[t] && reverseIndex[t] !== manifestUrl) {
          console.error(`[build] alsoHandles collision: ${t} already mapped to ${reverseIndex[t]}, also claimed by ${manifestUrl}`);
          process.exit(1);
        }
        reverseIndex[t] = manifestUrl;
      }
    }

    corpusLines.push(JSON.stringify(manifest));
  }

  const indexChanged = writeIfChanged(path.join(ROOT, "index.json"), JSON.stringify(index, null, 2) + "\n");
  const reverseChanged = writeIfChanged(path.join(ROOT, "reverse-index.json"), JSON.stringify(reverseIndex, null, 2) + "\n");
  const corpusChanged = writeIfChanged(path.join(ROOT, "corpus.jsonl"), corpusLines.join("\n") + "\n");

  console.log(`[build] ${names.length} manifests — ${htmlChanged} html updated, index.json ${indexChanged ? "updated" : "unchanged"}, reverse-index.json ${reverseChanged ? "updated" : "unchanged"}, corpus.jsonl ${corpusChanged ? "updated" : "unchanged"}`);
};

main();

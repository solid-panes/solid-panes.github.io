#!/usr/bin/env node
// Validate every <Name>/index.json against the manifest schema.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

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

const META = JSON.parse(fs.readFileSync(path.join(ROOT, "schema", "manifest.schema.json"), "utf8"));
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateMeta = ajv.compile(META);

const names = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(isTypeDir)
  .sort();

let ok = 0;
let failed = 0;
for (const name of names) {
  const filePath = path.join(ROOT, name, "index.json");
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch (e) { console.error(`[validate] ${name}: malformed JSON — ${e.message}`); failed++; continue; }

  const expectedTerm = `urn:solid:${name}`;
  if (manifest.term !== expectedTerm) {
    console.error(`[validate] ${name}: term "${manifest.term}" must match directory: "${expectedTerm}"`);
    failed++;
    continue;
  }
  if (!validateMeta(manifest)) {
    console.error(`[validate] ${name}: failed manifest schema:`, validateMeta.errors);
    failed++;
    continue;
  }
  ok++;
}

console.log(`[validate] ${ok} ok, ${failed} failed`);
if (failed > 0) process.exit(1);

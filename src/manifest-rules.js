/**
 * The rules Figma's "Import plugin from manifest…" enforces, in one place — both of these were
 * learned the hard way, from a plugin that would not import:
 *
 *  1. the file has to be called exactly `manifest.json` ("Each plugin must define a manifest.json
 *     file"), with `main`/`ui` resolved relative to it, so one folder per plugin;
 *  2. if `networkAccess` is present, `allowedDomains` must list at least one pattern — an empty
 *     list is invalid, and `["none"]` is the no-network value Figma's own manifest example uses.
 *
 * The checks call this, so a manifest that Figma would refuse fails `npm run lint` instead.
 */
const fs = require('node:fs');
const path = require('node:path');

function validateManifest({ file, main, ui, root }) {
  const problems = [];
  if (path.basename(file) !== 'manifest.json') {
    problems.push(`${file}: must be called manifest.json — that is the name Figma's importer looks for`);
  }
  const target = path.join(root, file);
  if (!fs.existsSync(target)) {
    problems.push(`${file}: missing`);
    return problems;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (error) {
    problems.push(`${file}: not valid JSON (${error.message})`);
    return problems;
  }
  for (const key of ['name', 'api', 'main', 'editorType']) {
    if (!manifest[key]) problems.push(`${file}: "${key}" is required`);
  }
  if (manifest.api && manifest.api !== '1.0.0') problems.push(`${file}: api is "${manifest.api}", expected "1.0.0"`);
  if (Array.isArray(manifest.editorType) && !manifest.editorType.includes('figma')) {
    problems.push(`${file}: editorType must include "figma"`);
  }
  const dir = path.dirname(file);
  if (manifest.main && main && path.join(dir, manifest.main) !== main) {
    problems.push(`${file}: main is "${manifest.main}", which is not ${main}`);
  }
  if (manifest.ui && ui && path.join(dir, manifest.ui) !== ui) {
    problems.push(`${file}: ui is "${manifest.ui}", which is not ${ui}`);
  }
  for (const key of ['main', 'ui']) {
    if (manifest[key] && !fs.existsSync(path.join(root, dir, manifest[key]))) {
      problems.push(`${file}: ${key} "${manifest[key]}" does not exist beside it`);
    }
  }
  if (manifest.networkAccess) {
    const domains = manifest.networkAccess.allowedDomains;
    if (!Array.isArray(domains) || domains.length === 0) {
      problems.push(`${file}: networkAccess.allowedDomains must list at least one pattern — use ["none"] for a plugin with no network access`);
    }
  }
  return problems;
}

module.exports = { validateManifest };

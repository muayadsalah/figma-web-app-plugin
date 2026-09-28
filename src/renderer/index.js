const fs = require('node:fs');
const path = require('node:path');

/** Dependency order: primitives, then nodes, then page, then board. */
const FILES = ['primitives.js', 'nodes.js', 'page.js', 'board.js'];

function source(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8');
}

/**
 * The four renderer sources, in dependency order, ready to inline into a generated plugin. They
 * are plain Figma plugin API code, not CommonJS: a generator concatenates them (plus its own data
 * and entry point) into a single `code.js` that the Figma sandbox can run.
 *
 * They expect a few globals to already exist at the point they run: `figma`, and (for `page.js`
 * and `board.js`) `MARKER_KEY`, `MARKER_NAMESPACE` and `MARKER_VALUE`, which the generated plugin
 * sets before these sources run.
 */
function rendererSources() {
  return FILES.map((file) => source(file));
}

/** The one file a board plugin shares: the page/marker/grid helper (`page.js`). */
function rendererPage() {
  return source('page.js');
}

module.exports = { FILES, source, rendererSources, rendererPage };

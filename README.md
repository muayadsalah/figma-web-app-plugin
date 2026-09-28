# figma-web-app-plugin

A small, dependency-free toolkit for **generating and verifying Figma plugins without opening
Figma**. It is the reusable core that a design-system plugin generator sits on top of, extracted so
it can live (and be published) on its own.

It does four things:

1. **A spec-driven canvas renderer** — `renderer/` is plain Figma plugin API code (no `require()`,
   no `module.exports`) that turns a JSON "screen spec" into real Figma nodes: frames, text,
   pills, tiles, progress dots, swatches and rules. A generator concatenates these sources with
   its own data and entry point into a single `code.js` the Figma sandbox can run.

2. **A strict fake plugin host** — `makeFigma()` / `makeNode()` model the parts of the Figma
   plugin API a board plugin touches, and are deliberately strict: an impossible edit (like `x`/`y`
   on a child of an auto-layout frame) throws, so a layout mistake fails in CI instead of
   silently inside someone's Figma file.

3. **Offline verification** — `runInHarness()` runs plugin code against the fake host in a fresh
   V8 context; `sandboxProblems()` checks the two calls a Figma sandbox forbids; `validateManifest()`
   enforces the manifest rules Figma's "Import plugin from manifest…" does.

4. **A reusable "export file to JSON" plugin** — `buildExportFilePlugin(config)` instantiates a
   plugin that reads a board's frames back out as JSON (matched by a shared plugin-data marker) so
   a designer's changes can be diffed against the app.

There are no runtime dependencies and no build step: the Node API is CommonJS, and the renderer is
shipped as source to inline.

## Usage

```js
const {
  makeFigma,
  makeNode,
  runInHarness,
  sandboxProblems,
  validateManifest,
  renderer,              // { rendererSources(), rendererPage() }
  buildExportFilePlugin,
} = require('figma-web-app-plugin');
```

See `test/smoke.test.js` for a runnable tour of the pieces.

## Layout

| Path | Role |
| --- | --- |
| `src/renderer/primitives.js` | fonts, colour, and the node primitives |
| `src/renderer/nodes.js` | the spec-node → Figma-node tree |
| `src/renderer/page.js` | page lookup, the marker, the grid |
| `src/renderer/board.js` | screens, placement and the notes frame |
| `src/fake-figma.js` | the strict fake plugin host |
| `src/manifest-rules.js` | the rules Figma's manifest importer enforces |
| `src/harness.js` | run plugin code in the fake host; sandbox checks |
| `src/export-file/` | the "export file to JSON" plugin template |
| `test/smoke.test.js` | `node --test` smoke coverage |

## The renderer contract

The four renderer sources are concatenated **in order** (`primitives`, `nodes`, `page`, `board`)
and expect a few globals to already exist at the point they run:

* `figma` — the Figma plugin API object (real or fake).
* `MARKER_KEY`, `MARKER_NAMESPACE`, `MARKER_VALUE` — set by the generated plugin before the
  `page.js`/`board.js` sources run; they define which frames a re-run owns.
* `fontTable`, `renderNodes`, … — defined by the earlier sources in the same concatenation.

## License

MIT — see [LICENSE](LICENSE).

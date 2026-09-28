/**
 * figma-web-app-plugin — a small, dependency-free toolkit for building and verifying Figma plugins
 * without opening Figma.
 *
 * CommonJS on purpose: the generators and checks that consume this are plain Node scripts, while
 * the renderer sources are plain Figma plugin API code (no require(), no module.exports) that a
 * generator inlines into the plugin it writes.
 */
const { makeFigma, makeNode } = require('./fake-figma');
const { validateManifest } = require('./manifest-rules');
const { stripComments, sandboxProblems, runInHarness } = require('./harness');
const renderer = require('./renderer');
const { buildExportFilePlugin } = require('./export-file');

module.exports = {
  makeFigma,
  makeNode,
  validateManifest,
  stripComments,
  sandboxProblems,
  runInHarness,
  renderer,
  buildExportFilePlugin,
};

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  makeFigma,
  makeNode,
  runInHarness,
  sandboxProblems,
  buildExportFilePlugin,
} = require('..');

test('the fake host is strict: x/y on an auto-layout child throws', () => {
  const parent = makeNode('FRAME', 'parent');
  parent.layoutMode = 'VERTICAL';
  const child = makeNode('FRAME', 'child');
  parent.appendChild(child);
  assert.throws(() => { child.x = 10; }, /auto-layout/);
});

test('runInHarness runs plugin code against the fake host', async () => {
  const figma = makeFigma();
  const code = 'figma.createPage().name = "made-by-plugin"; figma.closePlugin();';
  await runInHarness(code, figma, { filename: 'snippet.js', ticks: 1 });
  assert.equal(figma.root.children.some((page) => page.name === 'made-by-plugin'), true);
  assert.equal(figma.closed, true);
});

test('sandboxProblems flags require() and module.exports, after stripping comments', () => {
  assert.deepEqual(sandboxProblems('// require("x") is only mentioned\nconst a = 1;'), []);
  assert.deepEqual(
    sandboxProblems('require("node:fs");'),
    ['the plugin calls require(); Figma plugins are sandboxed'],
  );
  assert.deepEqual(
    sandboxProblems('module.exports = {};'),
    ['the plugin calls module.exports; Figma plugins are sandboxed'],
  );
});

test('buildExportFilePlugin substitutes every placeholder', () => {
  const config = {
    pluginName: 'My Export',
    pluginId: 'my-export',
    pageName: 'Screens',
    markerKey: 'generatedBy',
    markerNamespace: 'myApp',
    markerValue: 'my-board',
    boardPluginName: 'My Board',
    exportFilename: 'export.json',
    exportFilePath: 'my/export.json',
    diffCommand: 'npm run diff',
  };
  const files = buildExportFilePlugin(config);
  assert.ok(files['code.js'].includes("const MARKER_VALUE = 'my-board';"));
  const combined = files['code.js'] + files['ui.html'] + files['manifest.json'];
  assert.equal(/\{\{/.test(combined), false, 'a placeholder survived substitution');
});

test('buildExportFilePlugin fails loudly on a missing config value', () => {
  assert.throws(() => buildExportFilePlugin({}), /missing config/);
});

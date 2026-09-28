const vm = require('node:vm');

/**
 * Remove block and line comments, so a plugin whose *comment* mentions `require(` is not mistaken
 * for a plugin that actually calls it. (The export-file template's own header says "no require()",
 * which would otherwise trip the sandbox check.)
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * The two calls a Figma plugin sandbox forbids. `subject` names the file in the message
 * ("the plugin", "code.js", "the export plugin", …).
 */
function sandboxProblems(code, subject = 'the plugin') {
  const problems = [];
  const source = stripComments(code);
  if (/\brequire\(/.test(source)) problems.push(`${subject} calls require(); Figma plugins are sandboxed`);
  if (/module\.exports/.test(source)) problems.push(`${subject} calls module.exports; Figma plugins are sandboxed`);
  return problems;
}

/**
 * Run plugin code against a fake Figma host (see fake-figma.js) in a fresh V8 context.
 *
 * `html` is exposed as `__html__` — what `figma.showUI(__html__, …)` renders. `ticks` is how many
 * macrotask turns to drain before returning: a plugin is an async IIFE full of awaits, and a host
 * whose async methods resolve immediately needs a few turns to finish. The context is returned so
 * a check can reach helpers the plugin defined at top level.
 */
async function runInHarness(code, figma, options = {}) {
  const {
    filename = 'plugin.js',
    console: consoleOverride = console,
    html = '<html></html>',
    globals = {},
    ticks = 5,
  } = options;
  const context = vm.createContext({
    figma,
    console: consoleOverride,
    Date, JSON, Math, String, Number, Array, Object, Error, RegExp, Promise, setTimeout,
    __html__: html,
    ...globals,
  });
  vm.runInContext(code, context, { filename });
  for (let tick = 0; tick < ticks; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  return context;
}

module.exports = { stripComments, sandboxProblems, runInHarness };

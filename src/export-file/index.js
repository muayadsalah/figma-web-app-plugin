const fs = require('node:fs');
const path = require('node:path');

/** Output filename → template file. One folder, three files, as Figma's importer requires. */
const TEMPLATES = {
  'code.js': 'code.template.js',
  'ui.html': 'ui.template.html',
  'manifest.json': 'manifest.template.json',
};

function readTemplate(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8');
}

/**
 * Instantiate the "export file to JSON" plugin for one board.
 *
 * `config` must supply every placeholder the templates use:
 *   pluginName, pluginId, pageName, markerKey, markerNamespace, markerValue,
 *   boardPluginName, exportFilename, exportFilePath, diffCommand
 *
 * Returns an object keyed by output filename: `{ 'code.js', 'ui.html', 'manifest.json' }`.
 * The result is a Figma plugin sandbox: no require(), no module.exports, no network.
 */
function buildExportFilePlugin(config) {
  const missing = [];
  const output = {};
  for (const [outputName, templateName] of Object.entries(TEMPLATES)) {
    const text = readTemplate(templateName).replace(/\{\{(\w+)\}\}/g, (whole, key) => {
      const value = config[key];
      if (value === undefined || value === null) {
        missing.push(`${templateName}: {{${key}}}`);
        return whole;
      }
      return String(value);
    });
    output[outputName] = text;
  }
  if (missing.length) {
    throw new Error(`figma-web-app-plugin export-file template is missing config values:\n - ${missing.join('\n - ')}`);
  }
  return output;
}

module.exports = { buildExportFilePlugin, TEMPLATES };

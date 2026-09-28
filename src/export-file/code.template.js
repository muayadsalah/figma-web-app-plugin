/**
 * The "export file to JSON" plugin, as a template. A small generator instantiates it by filling
 * in its placeholders — see buildExportFilePlugin() in this package. The output is a Figma
 * plugin sandbox file: no require(), no module.exports, no network.
 *
 * The other direction. It reads the frames a board plugin drew — matched by *shared* plugin data,
 * so it exports exactly those and nothing a designer made by hand — and hands their values back
 * out as JSON for a differ to compare against the app's own capture of the same screens.
 *
 * In Figma: Plugins → Development → Import plugin from manifest… → the generated manifest.json →
 * run the plugin. The window shows what it found and downloads the JSON. The file it is imported
 * from must be called exactly `manifest.json`, in its own folder, because that is what Figma's
 * importer looks for; `main` and `ui` are resolved relative to it.
 *
 * Only what a design change can mean is exported: size, fills, strokes, corners, opacity,
 * shadows, and for text the characters, family, size and spacing. Position and size are exported
 * too, so a verifier can prove the file is the app's layout and not merely its colours, and
 * `textAutoResize` says how each text box was sized, which is what lets a box Figma measured
 * itself be told apart from one the board set to the browser's own numbers.
 */
const PAGE_NAME = '{{pageName}}';
const MARKER_KEY = '{{markerKey}}';
const MARKER_VALUE = '{{markerValue}}';
/**
 * The board writes its marker as *shared* plugin data, and shared data is the only kind another
 * plugin can read — `getPluginData` is private to the plugin ID that wrote it, so asking for the
 * marker that way returns nothing here, however many frames the board drew.
 */
const MARKER_NAMESPACE = '{{markerNamespace}}';

const round = (value) => (typeof value === 'number' ? Math.round(value * 100) / 100 : value);
// `figma.mixed` is a symbol a node returns when its values differ per character or corner.
const known = (value) => value !== undefined && value !== null && value !== figma.mixed;

function hex(color) {
  const channel = (value) => Math.round(Math.max(0, Math.min(1, value || 0)) * 255).toString(16).padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function readPaints(paints) {
  if (!known(paints) || !Array.isArray(paints)) return undefined;
  const visible = paints.filter((paint) => paint && paint.visible !== false);
  if (!visible.length) return undefined;
  return visible.map((paint) => (paint.type === 'IMAGE'
    ? { type: 'IMAGE', opacity: known(paint.opacity) ? round(paint.opacity) : 1 }
    : { type: 'SOLID', hex: hex(paint.color), opacity: known(paint.opacity) ? round(paint.opacity) : 1 }));
}

function readCorners(node) {
  const corners = {};
  for (const key of ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius']) {
    if (typeof node[key] === 'number') corners[key.replace('Radius', '')] = Math.round(node[key]);
  }
  return Object.keys(corners).length ? corners : undefined;
}

function readEffects(node) {
  if (!known(node.effects) || !Array.isArray(node.effects) || !node.effects.length) return undefined;
  const visible = node.effects.filter((effect) => effect && effect.visible !== false);
  if (!visible.length) return undefined;
  return visible.map((effect) => ({
    type: effect.type,
    hex: effect.color ? hex(effect.color) : undefined,
    alpha: effect.color && typeof effect.color.a === 'number' ? round(effect.color.a) : 1,
    radius: typeof effect.radius === 'number' ? Math.round(effect.radius) : 0,
    offsetX: effect.offset ? Math.round(effect.offset.x) : 0,
    offsetY: effect.offset ? Math.round(effect.offset.y) : 0,
  }));
}

function readNode(node) {
  const out = { type: node.type };
  if (typeof node.name === 'string' && node.name) out.name = node.name;
  if (typeof node.width === 'number') {
    out.width = round(node.width);
    out.height = round(node.height);
  }
  // Position, in the same terms the capture uses: a child's x/y are relative to its frame, which
  // is what the board set them from.
  if (typeof node.x === 'number') out.x = round(node.x);
  if (typeof node.y === 'number') out.y = round(node.y);
  if (node.type === 'TEXT') {
    out.characters = node.characters;
    if (known(node.fontSize)) out.fontSize = round(node.fontSize);
    if (known(node.fontName)) {
      out.fontFamily = node.fontName.family;
      if (node.fontName.style && node.fontName.style !== 'Regular') out.fontStyle = node.fontName.style;
    }
    if (known(node.lineHeight)) out.lineHeight = node.lineHeight;
    if (known(node.letterSpacing)) out.letterSpacing = node.letterSpacing;
    if (known(node.textAlignHorizontal)) out.textAlignHorizontal = node.textAlignHorizontal;
    if (known(node.textAutoResize)) out.textAutoResize = node.textAutoResize;
  }
  const fills = readPaints(node.fills);
  if (fills) out.fills = fills;
  const strokes = readPaints(node.strokes);
  if (strokes) out.strokes = strokes;
  if (typeof node.strokeWeight === 'number' && node.strokeWeight !== 1) out.strokeWeight = round(node.strokeWeight);
  const corners = readCorners(node);
  if (corners) out.corners = corners;
  if (known(node.opacity) && node.opacity !== 1) out.opacity = round(node.opacity);
  const effects = readEffects(node);
  if (effects) out.effects = effects;
  if (node.children) out.children = node.children.map(readNode);
  return out;
}

/**
 * `figma.ui.postMessage` throws "no UI to send message to. Did you forget to create ui?" unless
 * the plugin has *created* the UI — a `ui` field in the manifest only makes `__html__` available,
 * it does not open a window. So: open the window, wait for it to say it is listening, then send.
 * (The message goes out only after 'ready', because a postMessage fired before the iframe has
 * registered its listener is dropped.)
 */
async function exportBoard() {
  const page = figma.root.children.find((entry) => entry.name === PAGE_NAME) || figma.currentPage;
  if (typeof figma.setCurrentPageAsync === 'function') await figma.setCurrentPageAsync(page);
  else figma.currentPage = page;

  const frames = page.children.filter((node) => node.type === 'FRAME'
    && node.getSharedPluginData(MARKER_NAMESPACE, MARKER_KEY) === MARKER_VALUE);
  if (!frames.length) {
    figma.notify(
      'No board frames on "' + page.name + '". Run "{{boardPluginName}}" first: '
      + 'the export finds its frames by the shared marker ' + MARKER_NAMESPACE + '/' + MARKER_KEY + '.',
      { error: true },
    );
  }
  const screens = frames.map((frame) => ({
    name: frame.name,
    width: round(frame.width),
    height: round(frame.height),
    nodes: readNode(frame),
  }));
  figma.ui.postMessage({
    type: 'export',
    payload: { plugin: '{{pluginId}}', page: page.name, marker: MARKER_VALUE, screens },
  });
  if (frames.length) figma.notify('Exported ' + frames.length + ' frame' + (frames.length === 1 ? '' : 's') + ' — save the JSON from the window.');
}

figma.showUI(__html__, { width: 360, height: 470 });
figma.ui.onmessage = (message) => {
  if (!message) return;
  if (message.type === 'ready') {
    exportBoard().catch((error) => figma.notify('Export failed: ' + error.message, { error: true }));
  }
  if (message.type === 'close') figma.closePlugin();
};


/**
 * A fake Figma plugin host, just enough to run the generated plugin in Node.
 *
 * This is how the plugin is verified without opening Figma: the plugin talks to a
 * global `figma`, so the verifier supplies one and asserts what would be created.
 * It is deliberately strict — an unknown property assignment throws, so a typo in the
 * renderer fails here instead of silently in the file.
 */

const WARNED = new Set();

/** Families are matched the way Figma's importer matches them: by their letters alone. */
const familyKeyOf = (fontName) => String((fontName && fontName.family) || '').toLowerCase().replace(/[^a-z]/g, '');

function makeNode(type, name = type, host = null) {
  const node = {
    type,
    name,
    __host: host,
    children: [],
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    layoutMode: 'NONE',
    itemSpacing: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
    fills: [],
    strokes: [],
    strokeWeight: 1,
    strokeAlign: 'CENTER',
    cornerRadius: 0,
    // Figma reports every corner of every node, 0 when there is none — the capture omits zeros.
    // Modelling the default is what lets the checks see a diff that treats absent as missing.
    topLeftRadius: 0,
    topRightRadius: 0,
    bottomLeftRadius: 0,
    bottomRightRadius: 0,
    clipsContent: true,
    fontName: null,
    characters: '',
    lineHeight: null,
    letterSpacing: { unit: 'PERCENT', value: 0 },
    textAutoResize: 'NONE',
    layoutAlign: 'INHERIT',
    layoutGrow: 0,
  };
  // Text hugs its content in Figma, but every box this harness sees came from a real browser
  // render of that text, so the requested height already *is* the content height. Honouring it
  // keeps the harness faithful — and means any font shrinking the html-to-figma sandbox does
  // (when a face is missing) shows up as a real difference instead of being hidden here.
  const fontSize = { value: 16 };
  Object.defineProperty(node, 'fontSize', {
    get: () => fontSize.value,
    set: (value) => { fontSize.value = value; },
  });
  if (type === 'TEXT') {
    // A text node does not have a height someone sets: Figma measures the text. This harness has
    // no font metrics of its own, so it models the two things the sandbox's fit loop reacts to —
    // the height follows the font size, and a face the file had to *substitute* measures `measure`
    // times the box the browser captured (declared on the font entry, see `makeFigma`). That is
    // what makes a missing face come out as a smaller size in a real file rather than as text that
    // merely looks different, and it is why the board's type pass restores the captured size
    // instead of trusting what the fit loop left behind.
    const box = { width: node.width, height: node.height, base: fontSize.value };
    Object.defineProperty(node, 'width', {
      get: () => box.width,
      set: (value) => { box.width = value; },
    });
    Object.defineProperty(node, 'height', {
      get: () => {
        if (node.textAutoResize !== 'HEIGHT') return box.height;
        const measure = node.__host && node.__host.fontMeasure ? node.__host.fontMeasure(node.fontName) : 1;
        return box.height * (fontSize.value / box.base) * measure;
      },
      set: (value) => { box.height = value; },
    });
    // The captured box, and the size it was captured at: the model's starting point.
    node.__box = box;
  }
  node.appendChild = (child) => {
    node.children.push(child);
    child.parent = node;
    return child;
  };
  // Plugin data is per *node*, and private data is additionally scoped to the plugin ID that
  // wrote it: a second plugin asking for the same key gets nothing, while shared data is
  // namespaced and readable by anyone. Two of ours have to agree on which frames are the board,
  // so they use shared — and this harness models the difference, because not modelling it let a
  // real bug through once.
  node.__pluginData = new Map();
  node.__sharedPluginData = new Map();
  const hostOf = () => {
    if (!node.__host) node.__host = { pluginId: 'unhosted-plugin' };
    return node.__host;
  };
  node.setPluginData = (key, value) => {
    const scoped = `${hostOf().pluginId}\u0000${key}`;
    if (value === '') node.__pluginData.delete(scoped);
    else node.__pluginData.set(scoped, value);
  };
  node.getPluginData = (key) => node.__pluginData.get(`${hostOf().pluginId}\u0000${key}`) || '';
  node.setSharedPluginData = (namespace, key, value) => {
    // The docs: "The namespace must be at least 3 alphanumeric characters." We use a namespace
    // that is alphanumeric with no punctuation at all, so no reading of that can object.
    if (typeof namespace !== 'string' || !/^[a-z0-9][a-z0-9-]{2,}$/i.test(namespace)) {
      throw new Error(`shared plugin data needs a namespace of at least 3 characters, got ${JSON.stringify(namespace)}`);
    }
    const scoped = `${namespace}\u0000${key}`;
    if (value === '') node.__sharedPluginData.delete(scoped);
    else node.__sharedPluginData.set(scoped, value);
  };
  node.getSharedPluginData = (namespace, key) => node.__sharedPluginData.get(`${namespace}\u0000${key}`) || '';
  Object.defineProperty(node, 'absoluteBoundingBox', {
    get: () => ({ x: node.x, y: node.y, width: node.width, height: node.height }),
  });
  node.remove = () => {
    if (node.parent) node.parent.children = node.parent.children.filter((entry) => entry !== node);
    node.removed = true;
  };
  // Figma refuses x/y on a child of an auto-layout frame; catching it here means a
  // layout mistake fails the check instead of failing inside someone's Figma file.
  const positions = { x: 0, y: 0 };
  for (const axis of ['x', 'y']) {
    Object.defineProperty(node, axis, {
      get: () => positions[axis],
      set: (value) => {
        const parent = node.parent;
        if (parent && parent.layoutMode && parent.layoutMode !== 'NONE') {
          throw new Error(`cannot set ${axis} on "${node.name}": its parent "${parent.name}" still uses auto-layout`);
        }
        positions[axis] = value;
      },
    });
  }
  node.resize = (width, height) => {
    node.width = width;
    node.height = height;
    // A text node's own measure starts at the box it was given: this is the browser's box.
    if (type === 'TEXT' && node.__box) node.__box.base = node.fontSize;
  };
  node.setRangeFontName = (start, end, font) => {
    if (typeof start !== 'number' || typeof end !== 'number' || !font) {
      throw new Error(`setRangeFontName called badly on ${node.name}`);
    }
    node.ranges = (node.ranges || []).concat([{ start, end, font }]);
  };
  node.findAll = (predicate) => {
    const found = [];
    const walk = (entry) => {
      for (const child of entry.children || []) {
        if (!predicate || predicate(child)) found.push(child);
        walk(child);
      }
    };
    walk(node);
    return found;
  };
  return node;
}

/**
 * A fake Figma host.
 *
 * `pluginId` matters: it is who is running, and private plugin data is scoped to it, so a check
 * that runs two plugins against one file can switch it between runs exactly as Figma would.
 */
function makeFigma({ failFonts = [], fonts, pluginId = 'test-plugin' } = {}) {
  const loadedFonts = [];
  const svgs = [];
  // Figma always has Roboto; a file only has other families once someone installs them, which is
  // what the plugin's font hint is about.
  const availableFonts = fonts || [{ fontName: { family: 'Roboto', style: 'Regular' } }];
  const node = (type, name) => makeNode(type, name, figma);
  const figma = {
    pluginId,
    notified: [],
    closed: false,
    loadedFonts,
    svgs,
    scrolledTo: [],
    // dynamic-page access: a plugin must make a page current before touching its nodes.
    setCurrentPageAsync: async (target) => {
      figma.currentPage = target;
      figma.pagesMadeCurrent = (figma.pagesMadeCurrent || []).concat([target.name]);
    },
    loadFontAsync: async (font) => {
      if (failFonts.includes(font.family)) throw new Error(`font unavailable: ${font.family}`);
      loadedFonts.push(`${font.family}/${font.style}`);
    },
    listAvailableFontsAsync: async () => availableFonts,
    /**
     * How much taller a face measures than the box the browser captured — 1 for the faces the app
     * itself asks for, and `measure` for a substitute the sandbox fell back to. A font entry may
     * declare it (`{ fontName: {...}, measure: 1.3 }`), which is how a check reproduces the drift
     * a missing family causes in a real file.
     */
    fontMeasure: (fontName) => {
      const family = familyKeyOf(fontName);
      const style = String((fontName && fontName.style) || '');
      const entry = availableFonts.find((font) => familyKeyOf(font.fontName) === family && String((font.fontName && font.fontName.style) || '') === style);
      return (entry && entry.measure) || 1;
    },
    createPage: () => {
      const created = node('PAGE', 'Page');
      figma.root.children.push(created);
      return created;
    },
    // Newer API versions expose the async variant; the plugin prefers it when present.
    createPageAsync: async () => {
      const created = node('PAGE', 'Page');
      figma.root.children.push(created);
      return created;
    },
    createFrame: () => node('FRAME', 'Frame'),
    createText: () => node('TEXT', 'Text'),
    createEllipse: () => node('ELLIPSE', 'Ellipse'),
    createRectangle: () => node('RECTANGLE', 'Rectangle'),
    // The html-to-figma sandbox turns inline SVG layers into nodes this way.
    createNodeFromSvg: (svg) => {
      const created = node('FRAME', 'svg');
      created.svg = svg;
      svgs.push(svg);
      return created;
    },
    createImage: (bytes) => ({ hash: `image-${bytes && bytes.length ? bytes.length : 0}` }),
    getImageByHash: () => ({}),
    clientStorage: { getAsync: async () => null, setAsync: async () => {} },
    on: () => {},
    notify: (message, options) => figma.notified.push({ message, options }),
    closePlugin: () => { figma.closed = true; },
    uiMessages: [],
    ui: {
      // Figma throws this exact error when a plugin posts without ever calling showUI, which is
      // how the export plugin failed once: "no UI to send message to. Did you forget to create ui?"
      postMessage: (message) => {
        if (!figma.uiShown) throw new Error('no UI to send message to. Did you forget to create ui?');
        figma.uiMessages.push(message);
      },
      onmessage: null,
      resize: () => {},
    },
    showUI: () => { figma.uiShown = true; },
    // Figma returns this symbol from a node property whose values differ per character or corner.
    mixed: Symbol('figma.mixed'),
    viewport: { scrollAndZoomIntoView: (nodes) => figma.scrolledTo.push(nodes) },
  };
  const page = node('PAGE', 'Page 1');
  const root = node('DOCUMENT', 'Document');
  root.children.push(page);
  figma.root = root;
  figma.currentPage = page;
  figma.warned = WARNED;
  return figma;
}

module.exports = { makeFigma, makeNode };

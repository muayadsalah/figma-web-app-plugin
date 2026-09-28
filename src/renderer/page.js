/* ---------------------------------------------------------------------------
 * Renderer, part 2b: the page, the marker and the grid.
 *
 * Any plugin that draws a board uses these, so the page is found the same way, the same marker
 * decides what a re-run owns, and the same grid decides where frames land. The marker's key,
 * value and shared-data namespace are defined by each plugin — they are globals the generated
 * plugin must set before this file runs — so one plugin's frames are never mistaken for another's.
 * ------------------------------------------------------------------------ */

async function ensurePage(name) {
  const existing = figma.root.children.find((page) => page.name === name);
  if (existing) return existing;
  // `createPage` is the documented call; newer API versions add an async variant, and a
  // plugin with dynamic-page access should prefer it. Feature-detect rather than assume.
  const page = typeof figma.createPageAsync === 'function'
    ? await figma.createPageAsync()
    : figma.createPage();
  page.name = name;
  return page;
}

/**
 * Make a page current before reading or writing anything on it: a plugin with
 * `documentAccess: dynamic-page` cannot touch another page's nodes until it does.
 */
async function makeCurrent(page) {
  if (typeof figma.setCurrentPageAsync === 'function') {
    await figma.setCurrentPageAsync(page);
    return;
  }
  figma.currentPage = page;
}

/**
 * The marker. A frame counts as this board's if either the private marker (written by earlier
 * runs of this same plugin) or the shared one is present — but it is *written* to both, and the
 * shared copy is the one that matters: `setPluginData` is private to a plugin ID, so another
 * plugin (the export tool, a different ID) cannot read it, while `setSharedPluginData` is
 * readable by any plugin under a namespace of ours. Reading either is what lets frames drawn
 * before this existed still be replaced instead of duplicated.
 */
function markerOf(node) {
  return node.getPluginData(MARKER_KEY)
    || node.getSharedPluginData(MARKER_NAMESPACE, MARKER_KEY)
    || '';
}

function markGenerated(node) {
  node.setPluginData(MARKER_KEY, MARKER_VALUE);
  node.setSharedPluginData(MARKER_NAMESPACE, MARKER_KEY, MARKER_VALUE);
}

function generatedFrames(page) {
  return page.children.filter((node) => node.type === 'FRAME' && markerOf(node) === MARKER_VALUE);
}

function isGenerated(node) {
  return Boolean(node && node.type === 'FRAME' && markerOf(node) === MARKER_VALUE);
}

/** Free space below whatever is already on the page, in the page's own grid. */
function nextFreeRow(page, options) {
  const others = page.children.filter((node) => !isGenerated(node) && node.absoluteBoundingBox);
  if (!others.length) return { x: options.originX, y: options.originY };
  const bottom = Math.max(...others.map((node) => node.absoluteBoundingBox.y + node.absoluteBoundingBox.height));
  return { x: options.originX, y: Math.round(bottom + options.rowGap) };
}

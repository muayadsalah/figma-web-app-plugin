/* ---------------------------------------------------------------------------
 * Renderer, part 3: screens, placement and the notes frame. Inlined verbatim into a generated
 * plugin after nodes.js.
 *
 * The board is not one big frame: each screen becomes a top-level frame on the target
 * page, named in the file's own convention, so a designer can move or rename them like
 * any other candidate. Every frame the plugin makes is stamped with plugin data (see
 * page.js), so a later run replaces its own frames and nothing else — even after a rename.
 * ------------------------------------------------------------------------ */

function makeScreen(screen, tokens, fonts) {
  const band = screen.band;
  const frame = makeBox({
    name: screen.name,
    direction: screen.direction === 'row' ? 'row' : 'column',
    gap: 0,
    width: screen.width,
    fill: screen.background || 'bg',
  }, tokens, band);
  frame.counterAxisSizingMode = 'FIXED';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.clipsContent = false;
  frame.name = screen.name;
  for (const child of renderNodes(screen.nodes, tokens, fonts, band)) frame.appendChild(child);
  markGenerated(frame);
  return frame;
}

async function buildBoard(spec, options = {}) {
  const fonts = await fontTable(spec.tokens);
  const page = await ensurePage(options.pageName || spec.pageName);
  await makeCurrent(page);

  for (const frame of generatedFrames(page)) frame.remove();

  const origin = nextFreeRow(page, options);
  const columns = options.columns || 3;
  const columnWidth = Math.max(...spec.screens.map((screen) => screen.width));
  const created = [];
  let rowY = origin.y;
  let rowHeight = 0;

  spec.screens.forEach((screen, index) => {
    const frame = makeScreen(screen, spec.tokens, fonts);
    page.appendChild(frame);
    const column = index % columns;
    if (column === 0 && index > 0) {
      rowY += rowHeight + options.rowGapInner;
      rowHeight = 0;
    }
    frame.x = origin.x + column * (columnWidth + options.columnGap);
    frame.y = rowY;
    rowHeight = Math.max(rowHeight, frame.height);
    created.push(frame);
  });

  let notesFrame = null;
  if (spec.notes && spec.notes.length) {
    notesFrame = makeNotesFrame(spec, fonts, options);
    page.appendChild(notesFrame);
    notesFrame.x = origin.x;
    notesFrame.y = rowY + rowHeight + options.rowGapInner;
  }

  if (figma.viewport && figma.viewport.scrollAndZoomIntoView && created.length) {
    figma.viewport.scrollAndZoomIntoView([created[0], notesFrame || created[0]]);
  }
  return { page, screens: created.length, notes: Boolean(notesFrame), origin };
}

/** One frame holding what each screen is and why, instead of annotated screens. */
function makeNotesFrame(spec, fonts, options) {
  const width = options.notesWidth || 1240;
  const band = spec.notesBand || Object.keys(spec.tokens)[0];
  const frame = makeBox({ name: spec.notesTitle || 'Notes', gap: 12, fill: 'surface', width }, spec.tokens, band);
  frame.counterAxisSizingMode = 'FIXED';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.clipsContent = false;
  frame.paddingLeft = 40;
  frame.paddingRight = 40;
  frame.paddingTop = 40;
  frame.paddingBottom = 40;
  frame.cornerRadius = 24;
  frame.appendChild(makeText({
    text: spec.notesTitle || 'Notes', font: 'display', weight: 700, size: 'title', width: width - 80, leading: 1.3,
  }, spec.tokens, fonts, band));
  for (const note of spec.notes) {
    frame.appendChild(makeText({ text: note, weight: 600, size: 'body', color: 'inkSoft', width: width - 80, leading: 1.5 }, spec.tokens, fonts, band));
  }
  markGenerated(frame);
  return frame;
}

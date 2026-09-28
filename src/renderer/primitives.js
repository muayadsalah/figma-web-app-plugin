/* ---------------------------------------------------------------------------
 * Renderer, part 1: fonts, colour and the node primitives.
 * Inlined verbatim into a generated plugin by the figma-web-app-plugin renderer helper.
 * Edit these files, then regenerate the plugin. Figma plugin API only.
 * ------------------------------------------------------------------------ */

const WEIGHT_STYLES = {
  400: ['Regular'],
  600: ['Semi Bold', 'SemiBold', 'Medium', 'Regular'],
  700: ['Bold', 'Semi Bold', 'SemiBold'],
  800: ['Extra Bold', 'ExtraBold', 'Bold'],
};

/** Figma fonts are a family plus a style name that varies by family, so try aliases. */
async function resolveFont(families, weight) {
  const styles = WEIGHT_STYLES[weight] || WEIGHT_STYLES[400];
  for (const family of families) {
    for (const style of styles) {
      const candidate = { family, style };
      try {
        // eslint-disable-next-line no-await-in-loop
        await figma.loadFontAsync(candidate);
        return candidate;
      } catch (error) {
        // Not installed, or this family spells the style differently: keep trying.
      }
    }
  }
  return null;
}

async function fontTable(tokens) {
  const weights = [400, 600, 700, 800];
  const bands = Object.keys(tokens);
  // Every face the tokens name, deduped: a band whose own face is missing can still fall back to
  // another band's before giving up on the universal fallback.
  const faces = [...new Set(bands.flatMap((band) => [tokens[band].fontDisplay, tokens[band].fontBody]).filter(Boolean))];
  const table = {};
  for (const band of bands) {
    const families = {
      display: [tokens[band].fontDisplay, ...faces.filter((face) => face !== tokens[band].fontDisplay), 'Inter'],
      body: [tokens[band].fontBody, ...faces.filter((face) => face !== tokens[band].fontBody), 'Inter'],
    };
    table[band] = {};
    for (const role of ['display', 'body']) {
      for (const weight of weights) {
        // eslint-disable-next-line no-await-in-loop
        table[`${band}.${role}.${weight}`] = await resolveFont(families[role], weight);
      }
    }
  }
  return table;
}

function rgb(hex) {
  const value = String(hex).replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  };
}

function paint(hex) {
  return [{ type: 'SOLID', color: rgb(hex) }];
}

function colour(tokens, band, name) {
  return tokens[band][name] || name;
}

/** Token names arrive lower-case from the screens ('title', 'card'); keys are camel. */
function cap(name) {
  return String(name).charAt(0).toUpperCase() + String(name).slice(1);
}

function size(tokens, band, value) {
  if (value === undefined || value === null) return tokens[band].sizeBody;
  return typeof value === 'string' ? tokens[band][`size${cap(value)}`] : value;
}

function radiusOf(tokens, band, value) {
  if (value === undefined || value === null) return 0;
  return typeof value === 'string' ? (tokens[band][`radius${cap(value)}`] || 12) : value;
}

function makeText(spec, tokens, fonts, band) {
  const node = figma.createText();
  const role = spec.font || 'body';
  const weight = spec.weight || 400;
  const font = fonts[`${band}.${role}.${weight}`] || fonts[`${band}.body.400`];
  if (!font) throw new Error(`No usable font for ${band}/${role}/${weight}.`);
  node.fontName = font;
  node.characters = spec.text;
  if (spec.spans) {
    let cursor = 0;
    for (const span of spec.spans) {
      if (span.weight && span.weight !== weight) {
        node.setRangeFontName(cursor, cursor + span.text.length, fonts[`${band}.${role}.${span.weight}`] || font);
      }
      cursor += span.text.length;
    }
  }
  node.fontSize = size(tokens, band, spec.size);
  const leading = typeof spec.leading === 'string' ? tokens[band][spec.leading] : (spec.leading || tokens[band].leading);
  node.lineHeight = { unit: 'PERCENT', value: Math.round(leading * 100) };
  node.fills = paint(colour(tokens, band, spec.color || 'ink'));
  if (spec.letterSpacing) node.letterSpacing = { unit: 'PERCENT', value: spec.letterSpacing };
  node.textAutoResize = 'HEIGHT';
  const width = spec.width || 640;
  node.resize(width, Math.max(node.fontSize * 1.4, 10));
  if (spec.stretch) node.layoutAlign = 'STRETCH';
  return node;
}

function makeBox(spec, tokens, band) {
  const node = figma.createFrame();
  node.name = spec.name || spec.t || 'box';
  node.layoutMode = spec.direction === 'row' ? 'HORIZONTAL' : 'VERTICAL';
  node.itemSpacing = spec.gap === undefined ? tokens[band].gap : spec.gap;
  const pad = spec.pad === undefined ? 0 : spec.pad;
  node.paddingLeft = pad;
  node.paddingRight = pad;
  node.paddingTop = pad;
  node.paddingBottom = pad;
  node.primaryAxisSizingMode = 'AUTO';
  node.counterAxisSizingMode = 'AUTO';
  node.fills = spec.fill ? paint(colour(tokens, band, spec.fill)) : [];
  if (spec.stroke) {
    node.strokes = paint(colour(tokens, band, spec.stroke));
    node.strokeWeight = spec.strokeWeight || 2;
  }
  if (spec.radius) node.cornerRadius = radiusOf(tokens, band, spec.radius);
  if (spec.align) node.counterAxisAlignItems = spec.align;
  if (spec.justify) node.primaryAxisAlignItems = spec.justify;
  if (spec.width) {
    node.counterAxisSizingMode = 'FIXED';
    node.resize(spec.width, 100);
  }
  if (spec.stretch) node.layoutAlign = 'STRETCH';
  return node;
}

function makeEllipse(spec, tokens, band) {
  const node = figma.createEllipse();
  node.resize(spec.width || 12, spec.height || spec.width || 12);
  node.fills = paint(colour(tokens, band, spec.fill || 'border'));
  if (spec.stroke) {
    node.strokes = paint(colour(tokens, band, spec.stroke));
    node.strokeWeight = 2;
  }
  return node;
}

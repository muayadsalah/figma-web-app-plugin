/* ---------------------------------------------------------------------------
 * Renderer, part 2: the node tree. Inlined verbatim into a generated plugin
 * after primitives.js.
 * ------------------------------------------------------------------------ */

function renderNodes(specs, tokens, fonts, band) {
  const nodes = [];
  for (const spec of specs || []) {
    if (spec.t === 'text') {
      nodes.push(makeText(spec, tokens, fonts, band));
    } else if (spec.t === 'row' || spec.t === 'stack' || spec.t === 'box' || spec.t === 'card') {
      const node = makeBox(spec, tokens, band);
      if (spec.t === 'card') {
        if (!spec.radius) node.cornerRadius = tokens[band].radiusCard;
        if (spec.pad === undefined) {
          node.paddingLeft = 22;
          node.paddingRight = 22;
          node.paddingTop = 22;
          node.paddingBottom = 22;
        }
        if (!spec.stroke) {
          node.strokes = paint(colour(tokens, band, 'border'));
          node.strokeWeight = 2;
        }
        if (!spec.fill) node.fills = paint(colour(tokens, band, 'surface'));
      }
      for (const child of renderNodes(spec.children, tokens, fonts, band)) node.appendChild(child);
      nodes.push(node);
    } else if (spec.t === 'pill') {
      const box = makeBox({
        direction: 'row',
        fill: spec.variant === 'primary' ? 'primary' : (spec.variant === 'secondary' ? 'badgeBg' : 'surface'),
        stroke: spec.variant === 'ghost' ? 'border' : null,
        radius: 'pill',
        justify: 'CENTER',
        align: 'CENTER',
      }, tokens, band);
      box.name = `pill/${spec.label}`;
      box.appendChild(makeText({
        text: spec.label,
        font: spec.variant === 'primary' ? 'display' : 'body',
        weight: 800,
        size: spec.variant === 'primary' ? tokens[band].sizeAnswer : tokens[band].sizeBody,
        color: spec.variant === 'primary' ? 'primaryInk' : 'inkSoft',
        width: Math.max(60, spec.label.length * 11),
        leading: 1.3,
      }, tokens, fonts, band));
      const horizontal = spec.variant === 'primary' ? 34 : 20;
      box.paddingLeft = horizontal;
      box.paddingRight = horizontal;
      box.paddingTop = 12;
      box.paddingBottom = 12;
      box.primaryAxisSizingMode = 'AUTO';
      box.counterAxisSizingMode = 'AUTO';
      nodes.push(box);
    } else if (spec.t === 'dots') {
      const row = makeBox({ direction: 'row', gap: 6, align: 'CENTER' }, tokens, band);
      row.name = 'progress dots';
      for (let index = 0; index < (spec.total || 0); index += 1) {
        const state = index < spec.index ? 'passed' : (index === spec.index ? 'current' : 'ahead');
        row.appendChild(makeEllipse({
          width: state === 'current' ? 26 : 12,
          height: 12,
          fill: state === 'passed' ? 'mint' : (state === 'current' ? 'primary' : 'border'),
        }, tokens, band));
      }
      nodes.push(row);
    } else if (spec.t === 'tile') {
      const tile = makeBox({
        direction: 'row', gap: 14, pad: 18, fill: 'surface', stroke: 'border', width: spec.width || 300,
      }, tokens, band);
      tile.cornerRadius = Math.max(8, tokens[band].radiusCard - 2);
      tile.counterAxisAlignItems = 'MIN';
      tile.name = `tile/${spec.title}`;
      const icon = makeBox({ fill: spec.tone || 'badgeBg', align: 'CENTER', justify: 'CENTER' }, tokens, band);
      icon.primaryAxisSizingMode = 'FIXED';
      icon.counterAxisSizingMode = 'FIXED';
      icon.resize(56, 56);
      icon.cornerRadius = Math.max(6, tokens[band].radiusAnswer - 2);
      icon.name = 'tile icon';
      tile.appendChild(icon);
      const body = makeBox({ gap: 6 }, tokens, band);
      body.layoutGrow = 1;
      body.name = 'tile body';
      body.appendChild(makeText({
        text: spec.title, weight: 700, size: tokens[band].sizeBody, width: (spec.width || 300) - 110, leading: 1.35,
      }, tokens, fonts, band));
      if (spec.meta) {
        body.appendChild(makeText({
          text: spec.meta, weight: 600, size: tokens[band].sizeKicker, color: 'inkSoft', width: (spec.width || 300) - 110, leading: 1.35,
        }, tokens, fonts, band));
      }
      tile.appendChild(body);
      nodes.push(tile);
    } else if (spec.t === 'swatch') {
      const box = makeBox({ direction: 'row', gap: 12, align: 'CENTER' }, tokens, band);
      const chip = makeBox({ fill: spec.fill, stroke: 'border' }, tokens, band);
      chip.primaryAxisSizingMode = 'FIXED';
      chip.counterAxisSizingMode = 'FIXED';
      chip.resize(40, 40);
      chip.cornerRadius = 10;
      chip.name = spec.label;
      box.appendChild(chip);
      box.appendChild(makeText({
        text: `${spec.label}  ${spec.fill}`,
        weight: 600,
        size: tokens[band].sizeKicker,
        color: spec.onDark ? 'primaryInk' : 'ink',
        width: 260,
        leading: 1.3,
      }, tokens, fonts, band));
      nodes.push(box);
    } else if (spec.t === 'rule') {
      const line = figma.createRectangle();
      line.name = 'rule';
      line.resize(spec.width || 600, spec.weight || 2);
      line.fills = paint(colour(tokens, band, spec.fill || 'border'));
      if (spec.stretch) line.layoutAlign = 'STRETCH';
      nodes.push(line);
    } else if (spec.t === 'space' || spec.t === 'grow') {
      const spacer = figma.createRectangle();
      spacer.name = spec.t;
      spacer.resize(spec.width || 1, spec.height || 24);
      spacer.fills = [];
      if (spec.t === 'grow' || spec.grow) spacer.layoutGrow = 1;
      nodes.push(spacer);
    } else {
      throw new Error(`Unknown spec node: ${spec.t}`);
    }
  }
  return nodes;
}

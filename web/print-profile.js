/** Geometry profile; these are candidate support dimensions, not slicer settings. */
export const DOWELL = Object.freeze({
  id: 'dowell-dl1824-16', name: 'Dowell DL1824-16',
  x: 1800, y: 2400, z: 1600,
  nozzle: 1.6, line: 1.6, firstLine: 1.9, layer: 0.6, firstLayer: 0.5,
});

export function validLayers(layer, firstLayer) {
  return [layer, firstLayer].every((v) => Number.isFinite(v) && v >= 0.1 && v <= 0.8);
}

/** Nearest cell on the slicer's layer grid, including a different first layer. */
export function layerCell(z, height, first = height) {
  if (![z, height, first].every(Number.isFinite) || height <= 0 || first <= 0) {
    throw new RangeError('Invalid layer grid');
  }
  const n = Math.max(0, Math.round((z - first) / height));
  const top = first + n * height;
  return { top, bottom: n === 0 ? 0 : top - height };
}

/** Same dimensions in the worker and in manually drawn supports. */
export function configureDowell({ FIN, PROP, PERP, PAD, SWAY, CUT }, layer, firstLayer) {
  if (!validLayers(layer, firstLayer)) throw new RangeError('Camadas: use 0,1 a 0,8 mm.');
  const line = DOWELL.line, wall = 2 * line, foot = 2 * DOWELL.firstLine;
  Object.assign(FIN, { th: wall, tineW: line, tineH: layer, baseH: firstLayer,
    tineGrip: line / 2, padMargin: 4 * DOWELL.firstLine });
  Object.assign(PROP, { th: wall, tip: line, baseH: firstLayer, squatBrimH: firstLayer,
    footMin: foot, footMax: foot, squatBrimW: foot,
    tineW: line, tineH: layer, tineBite: 0.75 * line, tineOverlap: line / 2,
    tineStep: 2 * line, tineStepSparse: 5 * line, minTineStep: 1.5 * line });
  Object.assign(PERP, { th: wall, footHalf: foot, footH: firstLayer });
  Object.assign(PAD, { brimGap: 0.3 });
  Object.assign(SWAY, { thMin: wall, thMax: 3 * line, tineW: line,
    tineOverlap: line / 2, footH: firstLayer, footHalf: foot,
    footPad: foot, wallHalf: foot + wall / 2 });
  Object.assign(CUT, { web: wall, rail: wall, post: wall, latStrut: wall,
    pitch: 16, latPitch: 14 });
}

import { assert, assertClose, tiltedBlockTopo, blockTopo, analyze, fins, prop,
  loadModel, rotX, isClosed, bbox, insidePart } from './_util.js';
import { DOWELL, layerCell, validLayers } from '../web/print-profile.js';
import { drawnWall } from '../web/draw.js';
import { buildSwayBraces } from '../web/sway.js';

const ID = [1, 0, 0, 0, 1, 0, 0, 0, 1], OFF = { x: 0, y: 0, z: 0 };
const opts = { printerProfile: DOWELL.id, mode: 'auto', tines: true,
  layerHeight: 0.6, firstLayerHeight: 0.5, bedPad: true,
  tunables: { finGap: 0.6, propGap: 0.6, tineBite: 1.2, propBite: 1.2,
    padH: 0.5, padGrab: 0.05, padStyle: 'light' } };

function checkTines(caps) {
  assert(caps.length > 0, 'no tines generated');
  for (const t of caps) {
    assertClose(t.width, 1.6, 1e-8, 'one extrusion line wide');
    assertClose(t.top - t.bottom, 0.6, 1e-8, 'one body layer tall');
    const n = (t.top - 0.5) / 0.6;
    assertClose(n, Math.round(n), 1e-8, 'first-layer offset missing');
  }
}

Deno.test('Dowell: documented volume and different first/body layer grid', () => {
  assert(DOWELL.x === 1800 && DOWELL.y === 2400 && DOWELL.z === 1600);
  assert(DOWELL.nozzle === 1.6 && DOWELL.firstLine === 1.9);
  assert(validLayers(0.6, 0.5));
  for (const h of [0, -1, NaN, Infinity, 0.9]) assert(!validLayers(h, 0.5));
  assertClose(layerCell(0.4, 0.6, 0.5).bottom, 0, 1e-9);
  assertClose(layerCell(1.2, 0.6, 0.5).top, 1.1, 1e-9);
  assertClose(layerCell(1.2, 0.6, 0.5).bottom, 0.5, 1e-9);
});

for (const angle of [40, 60]) Deno.test(`Dowell: auto ${angle}deg forwards layers into props and wedges`, () => {
  const topo = tiltedBlockTopo(-45, 45, -60, 60, -8, 8, angle);
  const res = analyze(topo, 45, ID);
  globalThis.__TINECAP = [];
  try {
    const b = fins.buildFins(topo, res, ID, opts);
    assert(b.triangles.length > 0 && isClosed(b.triangles), 'supports must be closed solids');
    checkTines(globalThis.__TINECAP);
    for (const t of globalThis.__TINECAP) {
      assert(insidePart(topo, ID, res.offset, t.x + t.biteX * 1.2, t.y + t.biteY * 1.2, t.z), 'tine grips air');
    }
  } finally { delete globalThis.__TINECAP; }
});

Deno.test('Dowell: light pad follows first layer, not body layer', () => {
  const topo = loadModel('cube'), rot = rotX(45), res = analyze(topo, 45, rot);
  const b = fins.buildFins(topo, res, rot, opts);
  assert(b.padTriangles.length > 0 && isClosed(b.padTriangles));
  assertClose(bbox(b.padTriangles).hi[2], 0.5, 1e-8);
});

Deno.test('Dowell: manually drawn supports use the same line and layer grid', () => {
  fins.applyDowellProfile();
  fins.applyTunables(opts.tunables);
  const topo = tiltedBlockTopo(-30, 30, -40, 40, -8, 8, 45);
  // Draw across the interior of the face, clear of the upper edge where a
  // nearest side face can legitimately reject the horizontal grip.
  const best = { y: 0, z: Math.min(...prop.surfaceZsAt(topo.pos, 0, 0)) };
  globalThis.__TINECAP = [];
  try {
    const r = drawnWall([-15, best.y, best.z], [15, best.y, best.z], topo.pos, 0,
      { ...opts, topo, rot: ID, offset: OFF });
    assert(r.ok && isClosed(r.tris), `draw failed: ${r.reason}`);
    checkTines(globalThis.__TINECAP);
  } finally { delete globalThis.__TINECAP; }
});

Deno.test('Dowell: sway brace teeth are 1.6mm wide on the 0.5 + n*0.6 grid', () => {
  fins.applyDowellProfile();
  const topo = blockTopo(-20, 20, -15, 15, 0, 150), res = analyze(topo, 45, ID);
  const s = buildSwayBraces(topo, res, ID, { ...opts, gap: 0.6, bite: 1.2 });
  assert(s.count >= 2 && isClosed(s.triangles));
  let n = 0;
  for (let i = 0; i + 36 <= s.triangles.length; i += 36) {
    const b = bbox(s.triangles.slice(i, i + 36));
    if (Math.abs(b.hi[2] - b.lo[2] - 0.6) > 1e-7) continue;
    n++;
    const k = (b.lo[2] - 0.5) / 0.6;
    assertClose(k, Math.round(k), 1e-7);
    assertClose(Math.min(b.hi[0] - b.lo[0], b.hi[1] - b.lo[1]), 1.6, 1e-7);
  }
  assert(n > 0 && n === s.tines, 'missing or incorrectly sized tine boxes');
});

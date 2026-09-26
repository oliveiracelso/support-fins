/**
 * The options panel: support mode, the fins / "+ Add" toggles, bed pad style,
 * tines, sway braces, gap, cutouts, material profile, and the collapsible
 * sections with their one-line recaps. Owns finsVisible / finMode / drawAugment.
 */
import { DOWELL, validLayers } from '../print-profile.js';
import { FIN, PAD, applyDowellProfile } from '../fins.js';
import { PROP } from '../prop.js';
import { CUT } from '../cutout.js';
import { el } from './dom.js';
import { histPush } from './history.js';
import { removeMode, syncRemoveUI, cancelRemove } from './remove.js';
import { setDrawMsg, clearPreview, syncDrawControls } from './walls.js';
import { lastBuilt, refreshFins, markFinsStale } from './finbuild.js';
import { setGizmo } from './pose.js';

export let finsVisible = false;
export function setFinsVisible(v) { finsVisible = v; }
// The wall is the default support and the fin is the Brace OPTION, not the
// other way around -- flipped at M5c. Measured over the dev matrix, the fin
// covers 4% of overhang area (it braces against toppling; it holds nothing up)
// and 7 of its 12 placements lean 25-40deg. The wall covers 61%, always
// vertical. A user who loads a part and exports should get the support that
// supports.
//
// DEFAULT IS 'auto': click "Add fins" and the tool places the supports for you
// (tined combined fins on the grippable overhangs, plain props on the rest). Draw
// is the by-hand path. ('prop' still exists internally -- Draw calls it for the
// bed pad + seating verdict, and it is the geometry Auto props with.)
export let finMode = 'auto';
export function setFinMode(v) { finMode = v; }
// Suggest + Draw mix: when true, the pointer places hand-drawn walls ON TOP of the
// auto-placed ones (for when auto misses a spot). It only gates the pointer; the
// drawn walls themselves stay shown/exported after placing until Clear all.
export let drawAugment = false;
export function setDrawAugment(v) { drawAugment = v; }
/** The "+ Add walls by hand" toggle, shown only in Suggest mode. */
export function syncAugmentUI() {
  const show = finsVisible && finMode === 'auto';
  el('augment-toggle').hidden = !show;
  el('augment-toggle').classList.toggle('primary', drawAugment);
  el('augment-toggle').textContent = drawAugment ? 'Done adding walls' : '+ Add walls by hand';
}

el('fin-mode').addEventListener('change', (e) => {
  histPush();
  finMode = e.target.value;
  el('coverage-fld').hidden = finMode !== 'auto';  // row density only applies to Auto
  drawAugment = false;      // start each mode with hand-placement off
  if (removeMode) cancelRemove();
  setDrawMsg('');
  clearPreview();
  syncAugmentUI();
  syncDrawControls();
  syncRemoveUI();
  setGizmo();
  refreshFins();
});
// Bed pad style (PAD.style in fins.js). Only Custom shows the pad's numbers; the
// presets keep theirs fixed (Sure hold's follow the material profile). Switching
// to Custom starts it from whichever preset was showing, so a tweak begins from
// numbers that are known to print rather than from blanks.
const PAD_FIELDS = { h: 'pad-h', gap: 'pad-gap', grip: 'pad-grip', margin: 'pad-margin' };
function padPreset(style) {
  // Auto starts Custom from whatever it last built.
  if (style === 'auto') style = lastBuilt?.pad?.style === 'sure' ? 'sure' : 'light';
  return style === 'sure'
    ? { h: FIN.padH, gap: 0, grip: PAD.grab, margin: FIN.padMargin }
    : { h: el('first-layer-height').valueAsNumber || DOWELL.firstLayer, gap: PAD.brimGap, grip: 0, margin: FIN.padMargin };
}
let padShown = el('bed-pad').value;
function syncPadStyle() {
  const v = el('bed-pad').value;
  if (v === 'custom' && padShown !== 'custom') {
    const p = padPreset(padShown);
    for (const [k, id] of Object.entries(PAD_FIELDS)) el(id).value = +p[k].toFixed(2);
    readPadCustom();
  }
  if (v !== 'off') PAD.style = v;
  padShown = v;
  for (const f of document.querySelectorAll('[data-pad-custom]')) f.hidden = v !== 'custom';
  syncTineGrip();
  syncSectionSums();
}
function readPadCustom() {
  for (const [k, id] of Object.entries(PAD_FIELDS)) {
    const input = el(id), v = input.valueAsNumber;
    if (Number.isFinite(v)) PAD.custom[k] = Math.min(+input.max, Math.max(+input.min, v));
  }
}
el('bed-pad').addEventListener('change', () => { syncPadStyle(); refreshFins(); });
for (const id of Object.values(PAD_FIELDS)) {
  el(id).addEventListener('input', () => { readPadCustom(); debouncedRefresh(); });
}
// A slider fires `input` on every pixel of a drag; on a big part one regenerate can
// take a while, so re-running it per tick freezes the page mid-drag. Coalesce the
// drag into a single rebuild once the value settles. `change` (fires on release) is
// too coarse -- no live preview at all -- so debounce instead: quick enough to feel
// live on a small part, one rebuild instead of dozens on a large one.
let refreshTimer = null;
function debouncedRefresh(ms = 180) {
  markFinsStale();
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { refreshTimer = null; refreshFins(); }, ms);
}
// Tine grip only means anything when the tines are on, so hide its slider with the
// toggle (keeps the panel honest -- no dead control).
function syncTineGrip() {
  const on = el('tines').checked;
  el('tinegrip-fld').hidden = !on;
}
el('tines').addEventListener('change', () => { syncTineGrip(); refreshFins(); });
el('tine-density').addEventListener('input', () => debouncedRefresh());
const LAYER_STORE = 'sf.dowell.layers.v1';
function updateLayers() {
  const layer = el('layer-height').valueAsNumber;
  const first = el('first-layer-height').valueAsNumber;
  if (validLayers(layer, first)) {
    const bite = PROP.tineBite;
    applyDowellProfile(layer, first);
    PROP.tineBite = bite;
    FIN.padH = first;
    try { localStorage.setItem(LAYER_STORE, JSON.stringify({ layer, first })); } catch { /* optional */ }
  }
  debouncedRefresh();
}
for (const id of ['layer-height', 'first-layer-height']) el(id).addEventListener('input', updateLayers);
el('coverage').addEventListener('input', () => debouncedRefresh());

// Sway braces: the switch sits in its section header (like Tines), and its three
// settings only show while it is on, so an unused feature costs one line. The two
// tine settings additionally follow the global Tines toggle -- with tines off there
// is no comb to space.
function syncSway() {
  const on = el('sway').checked;
  el('sway-from-fld').hidden = !on || !el('tines').checked;
  el('sway-spacing-fld').hidden = !on || !el('tines').checked;
  el('sway-depth-fld').hidden = !on;
  syncDrawControls();
  syncSectionSums();
}
el('sway').addEventListener('change', () => {
  // Switching it on opens its section: the switch is in the header, so a collapsed
  // section would otherwise turn the feature on and hide its settings in one click.
  if (el('sway').checked) el('sway').closest('details').open = true;
  syncSway();
  refreshFins();
});
el('tines').addEventListener('change', syncSway);
for (const id of ['sway-from', 'sway-spacing', 'sway-depth']) {
  el(id).addEventListener('input', () => debouncedRefresh());
}

// Gap tuning. PROP.gap / PAD.grab are read fresh on every build, so setting them
// here and rebuilding is all it takes. Clamp to the input's own range so a typed
// value can't drive the support into the part or float it off the overhang.
function wireGap(id, obj, key, lo, hi) {
  const input = el(id);
  input.addEventListener('input', () => {
    const v = input.valueAsNumber;
    if (Number.isFinite(v)) {
      obj[key] = Math.min(hi, Math.max(lo, v));
      if (id === 'gap') FIN.gap = obj[key];
    }
    debouncedRefresh();
  });
}
wireGap('gap', PROP, 'gap', 0.1, 1.6);

// Wall cutouts (issue #34). CUT.pattern is read fresh by every wall sweep -- the
// drawn walls here on the page, the auto walls in the Worker via tunables.
el('cutout').addEventListener('change', () => {
  CUT.pattern = el('cutout').value;
  refreshFins();
});

// Candidate Dowell clearances. PLA/PETG breakaway behaviour still needs physical
// validation with the 1.6mm nozzle. density is g/cm^3 for the grams receipt.
const MATERIAL = {
  pla:  { finGap: 0.6, tineBite: 1.20, padH: 0.5, padGrab:  0.05, propGap: 0.6,  density: 1.24 },
  petg: { finGap: 0.8, tineBite: 0.60, padH: 0.5, padGrab: -0.10, propGap: 0.8,  density: 1.27 },
};
export let materialDensity = MATERIAL.pla.density;

function applyMaterial(name) {
  const m = MATERIAL[name] || MATERIAL.pla;
  FIN.gap = m.finGap;
  FIN.tineBite = m.tineBite;
  FIN.padH = el('first-layer-height').valueAsNumber || DOWELL.firstLayer;
  PAD.grab = m.padGrab;
  PROP.gap = m.propGap;
  PROP.tineBite = m.tineBite;
  materialDensity = m.density;
  // Reflect the profile's clearances in the exposed tunables so the numbers on
  // screen match what will actually print (and a later hand-tweak starts from the
  // material's baseline, not PLA's).
  el('gap').value = m.propGap;
  syncSectionSums();
}

el('material').addEventListener('change', () => {
  applyMaterial(el('material').value);
  debouncedRefresh();
});

/** The fins-toggle button's appearance for the current finsVisible. Factored out
 *  so undo/redo can re-sync it after restoring the flag. */
export function syncFinsToggleUI() {
  el('fins-toggle').classList.toggle('primary', finsVisible);
  el('fins-toggle').textContent = finsVisible ? 'Fins on' : 'Add fins';
  el('fin-opts').hidden = !finsVisible;
  syncSectionSums();
}

// ------------------------------------------------------------ options sections
//
// The options panel is grouped into <details> sections (issue #41). Two jobs here:
// remember which are open, and write each section's one-line recap so collapsing
// it never hides what's set. Storage is a convenience only -- private windows and
// blocked storage throw, and the panel then just opens in its default layout.
const SEC_KEY = 'sf.sections';
function loadSectionState() {
  try { return JSON.parse(localStorage.getItem(SEC_KEY)) || {}; } catch { return {}; }
}
{
  const saved = loadSectionState();
  for (const d of document.querySelectorAll('#fin-opts details.sec')) {
    if (d.dataset.sec in saved) d.open = !!saved[d.dataset.sec];
    d.addEventListener('toggle', () => {
      const state = loadSectionState();
      state[d.dataset.sec] = d.open;
      try { localStorage.setItem(SEC_KEY, JSON.stringify(state)); } catch { /* storage off */ }
    });
  }
}
// The Tines switch sits inside its section's <summary>; without this a click on it
// would also fold the section open or shut.
el('tines').closest('label').addEventListener('click', (e) => e.stopPropagation());
// ...and the same for the Sway braces switch, which sits in its own section header.
el('sway').closest('label').addEventListener('click', (e) => e.stopPropagation());

/** Refill each section's collapsed recap from the controls' current values. */
export function syncSectionSums() {
  const sel = (id) => el(id).selectedOptions[0]?.textContent.split(' —')[0] ?? '';
  el('sum-setup').textContent = `${sel('material')} · ${sel('fin-mode')}`;
  const grip = el('tine-density').valueAsNumber;
  el('sum-tines').textContent = el('tines').checked
    ? `${grip <= 20 ? 'light' : grip >= 80 ? 'firm' : 'medium'} grip · ${el('layer-height').value} mm`
    : 'off';
  el('sum-clearances').textContent =
    `${el('gap').value} mm gap · pad ${el('bed-pad').selectedOptions[0].textContent.toLowerCase()}`;
  const cut = el('cutout').value;
  el('sum-walls').textContent = cut === 'none' ? 'solid' : `${sel('cutout').toLowerCase()} cutouts`;
  el('sum-sway').textContent = el('sway').checked
    ? `${el('sway-spacing').value} mm tines · ${el('sway-depth').value}% deep`
      + (el('sway-from').valueAsNumber > 0 ? ` · from ${el('sway-from').value} mm` : '')
    : 'off';
}
el('fin-opts').addEventListener('input', syncSectionSums);
el('fin-opts').addEventListener('change', syncSectionSums);

el('fins-toggle').addEventListener('click', () => {
  histPush();
  finsVisible = !finsVisible;
  if (!finsVisible) drawAugment = false;
  if (removeMode) cancelRemove();
  syncFinsToggleUI();
  setDrawMsg('');
  clearPreview();
  syncAugmentUI();
  syncDrawControls();
  syncRemoveUI();
  setGizmo();
  refreshFins();
});

el('augment-toggle').addEventListener('click', () => {
  if (removeMode) cancelRemove();
  drawAugment = !drawAugment;
  setDrawMsg('');
  clearPreview();
  syncAugmentUI();
  syncDrawControls();
  setGizmo();
  refreshFins();
});

/** Bring the pad, tine, sway, cutout and material state in line with the controls
 *  (a reload can keep the browser's last values). Called once at startup. */
export function initSettings() {
  let layer = DOWELL.layer, first = DOWELL.firstLayer;
  try {
    const saved = JSON.parse(localStorage.getItem(LAYER_STORE));
    if (saved && validLayers(saved.layer, saved.first)) ({ layer, first } = saved);
  } catch { /* optional storage */ }
  el('layer-height').value = layer;
  el('first-layer-height').value = first;
  applyDowellProfile(layer, first);
  syncTineGrip();
  syncPadStyle();
  syncSway();
  CUT.pattern = el('cutout').value;   // a reload can keep the browser's last pick
  applyMaterial(el('material').value);   // sync density + tunables to the initial choice
}

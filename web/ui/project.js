import * as THREE from 'three';
import { DOWELL, validLayers } from '../print-profile.js';
import { writeBinarySTL } from '../stl.js';
import { writeThreeMF } from '../threemf.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { el } from './dom.js';
import { part, partName, topology, lastResult, threshold, setPart, shade, setThreshold } from './part.js';
import { buildExportGeometry } from './export.js';
import { currentVolume, setVolume } from './volume.js';
import { finsVisible, finMode, setFinsVisible, setFinMode, setDrawAugment, syncFinsToggleUI,
  syncAugmentUI, applySavedSettings } from './settings.js';
import { drawnWalls, setDrawnWalls, syncDrawControls } from './walls.js';
import { removedSigs, restoreRemovals } from './remove.js';
import { setGizmo } from './pose.js';
import { resetHistory } from './history.js';
import { calibrationPart } from '../calibration.js';

export const ENGINE = 'dowell-fins-1.6-v1';
const FIELDS = ['material','tines','tine-density','layer-height','first-layer-height','gap','bed-pad',
  'pad-h','pad-gap','pad-grip','pad-margin','coverage','cutout','sway','sway-from','sway-spacing','sway-depth'];
export let parentId = null;
export let testId = '';
let modelSerial = 0;
addEventListener('sf-part-loaded', () => { parentId = null; testId = ''; modelSerial++; });
export function markSavedVersion(id, serial) { if (serial === modelSerial) parentId = id; }

export function captureProject(name, notes) {
  const g = buildExportGeometry();
  if (!g) throw new Error('Aguarde o cálculo e importe uma peça antes de salvar.');
  const controls = Object.fromEntries(FIELDS.map(id => [id, el(id).type === 'checkbox' ? el(id).checked : el(id).value]));
  const state = { schema: 1, engine: ENGINE, profile: DOWELL.id, sourceName: partName,
    quaternion: part.quaternion.toArray(), volume: { ...currentVolume() }, threshold,
    controls, finsVisible, finMode, removedSigs: [...removedSigs], testId,
    walls: drawnWalls.map(w => ({ kind: w.kind || 'wall', face: w.face,
      a: w.a.toArray(), b: w.b?.toArray() })) };
  const source = [];
  for (let i=0;i<topology.pos.length;i+=3) source.push(Array.from(topology.pos.slice(i,i+3)));
  // Capture all geometry and parameters synchronously before hashing/upload awaits.
  const blobs = { 'source.stl': writeBinarySTL(source, partName),
    'generated.stl': writeBinarySTL([...g.partTris,...g.finTris],g.base),
    'generated.3mf': writeThreeMF(g.partTris,g.finTris,g.base),
    'project.json': new Blob([JSON.stringify(state)], { type: 'application/json' }) };
  return { id: crypto.randomUUID(), modelSerial, name: name.trim() || g.base, notes, parentId, sourceName: partName,
    summary: { material: controls.material, layer: +controls['layer-height'], firstLayer: +controls['first-layer-height'],
      gap: +controls.gap, size: [lastResult.size.x,lastResult.size.y,lastResult.size.z], test: testId, engine: ENGINE }, blobs };
}

function validateState(s) {
  const vector = (v,n) => Array.isArray(v) && v.length===n && v.every(x => Number.isFinite(x) && Math.abs(x)<100000);
  if (s?.schema!==1 || s.profile!==DOWELL.id || s.engine!==ENGINE || !vector(s.quaternion,4) ||
      Math.abs(Math.hypot(...s.quaternion)-1)>.001 || !s.controls || !validLayers(+s.controls['layer-height'],+s.controls['first-layer-height']) ||
      !['auto','draw'].includes(s.finMode) || !Number.isFinite(s.threshold) || s.threshold<30 || s.threshold>70 ||
      ![s.volume?.x,s.volume?.y,s.volume?.z].every(n => Number.isFinite(n) && n>=20 && n<=5000) ||
      !Array.isArray(s.walls) || s.walls.length>1000 || !Array.isArray(s.removedSigs) || s.removedSigs.length>5000 ||
      !s.removedSigs.every(x=>typeof x==='string' && x.length<300)) throw new Error('Projeto incompatível ou inválido. Os STL/3MF salvos continuam disponíveis.');
  for (const w of s.walls) if (!vector(w.a,3) || (w.kind!=='sway' && !vector(w.b,3)) ||
    (w.kind==='sway' && (!Number.isSafeInteger(w.face) || w.face<0))) throw new Error('Parede salva inválida.');
  for (const id of FIELDS) {
    const input=el(id), v=s.controls[id];
    if (input.type==='checkbox') { if(typeof v!=='boolean') throw new Error('Opção salva inválida.'); }
    else if (input.tagName==='SELECT') { if(!Array.from(input.options).some(o=>o.value===v)) throw new Error('Opção salva inválida.'); }
    else if (!Number.isFinite(+v) || +v < +input.min || +v > +input.max) throw new Error('Parâmetro salvo inválido.');
  }
}

export function openProject(state, sourceBuffer, id) {
  validateState(state);
  const geometry = new STLLoader().parse(sourceBuffer);
  const pos=geometry.getAttribute('position');
  if (!pos?.count || sourceBuffer.byteLength>100*1024*1024 || !pos.array.every(Number.isFinite)) throw new Error('Modelo salvo inválido.');
  for(const w of state.walls) if(w.kind==='sway' && w.face>=pos.count/3) throw new Error('Face salva inválida.');
  setFinsVisible(false);
  setPart(geometry,state.sourceName || 'peça.stl');
  el('drop').classList.add('hidden');
  for(const id of FIELDS) {
    const input=el(id);
    if(input.type==='checkbox') input.checked=state.controls[id]; else input.value=state.controls[id];
  }
  applySavedSettings();
  part.quaternion.fromArray(state.quaternion);
  setVolume(state.volume);
  setThreshold(state.threshold);
  setFinMode(state.finMode); el('fin-mode').value=state.finMode;
  setDrawAugment(false);
  setDrawnWalls(state.walls.map(w=>({...w,a:new THREE.Vector3().fromArray(w.a),b:w.b?new THREE.Vector3().fromArray(w.b):undefined,ok:false})));
  restoreRemovals(state.removedSigs);
  setFinsVisible(state.finsVisible);
  syncFinsToggleUI(); syncAugmentUI(); syncDrawControls(); setGizmo();
  parentId=id; testId=state.testId || '';
  shade(); resetHistory();
}

export function loadCalibration(id) {
  const c=calibrationPart(id), geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(c.vertices.flat(),3));
  setFinsVisible(false);
  setPart(geometry,`Dowell-teste-${id}.stl`);
  el('drop').classList.add('hidden');
  el('material').value='pla'; el('layer-height').value=.6; el('first-layer-height').value=.5;
  el('tines').checked=true; el('tine-density').value=0; el('coverage').value=50;
  el('gap').value=.6; el('bed-pad').value='auto'; el('cutout').value='none';
  el('sway').checked=c.sway; el('sway-from').value=0; el('sway-spacing').value=6; el('sway-depth').value=15;
  applySavedSettings();
  setFinMode('auto'); el('fin-mode').value='auto'; setDrawAugment(false);
  part.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),c.rotationX);
  setVolume({x:DOWELL.x,y:DOWELL.y,z:DOWELL.z}); setThreshold(45);
  setFinsVisible(true); syncFinsToggleUI(); syncAugmentUI(); syncDrawControls(); setGizmo();
  testId=id; shade(); resetHistory();
}

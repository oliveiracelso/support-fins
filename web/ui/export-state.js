import { el } from './dom.js';

let reason = 'Importe um modelo para exportar.';
export const exportReady = () => !reason;
export function setExportStatus(message = '') {
  reason = message;
  for (const id of ['export', 'export-3mf']) {
    el(id).disabled = !!reason;
    el(id).title = reason || 'Exportar geometria em milímetros para o OrcaSlicer';
  }
  el('export-status').textContent = reason;
  el('export-status').hidden = !reason;
  dispatchEvent(new Event('sf-export-state'));
}

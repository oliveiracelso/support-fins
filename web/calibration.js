/** Small, closed reference parts for comparing one support setting at a time. */
export const CALIBRATIONS = [
  { id: 'grip45', name: '01 · Placa inclinada — dentes',
    description: 'Placa 60 × 40 × 6,4 mm a 45°. Compare aderência dos dentes, marcas e esforço para destacar. Repita com grip leve, médio e firme mantendo a folga de 0,6 mm.' },
  { id: 'overhang', name: '02 · Balanço — folga',
    description: 'Peça em L de 60 × 32 × 40,1 mm. Compare folgas de 0,4 / 0,6 / 0,8 mm, mantendo os demais parâmetros. Observe queda do teto, acabamento inferior e remoção.' },
  { id: 'sway', name: '03 · Torre — escoras',
    description: 'Torre de 24 × 24 × 100,1 mm. Compare marcas, rigidez e desprendimento das escoras laterais. Faça depois de escolher a melhor combinação nos testes pequenos.' },
];

function block(x0, x1, y0, y1, z0, z1) {
  const v = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
    [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  const q = (a,b,c,d) => [v[a],v[b],v[c],v[a],v[c],v[d]];
  return [...q(0,3,2,1),...q(4,5,6,7),...q(0,1,5,4),...q(2,3,7,6),...q(1,2,6,5),...q(0,4,7,3)];
}

export function calibrationPart(id) {
  if (id === 'grip45') return { vertices: block(-30,30,-20,20,0,6.4), rotationX: Math.PI/4, sway: false };
  if (id === 'sway') return { vertices: block(-12,12,-12,12,0,100.1), rotationX: 0, sway: true };
  if (id === 'overhang') {
    // Extrude a concave L profile; caps are three rectangles with no overlapping solids.
    const p = [[-30,0],[-20.4,0],[-20.4,30.5],[30,30.5],[30,40.1],[-30,40.1]];
    const tris = [];
    const P = (i,y) => [p[i][0],y,p[i][1]];
    for (let i=0;i<p.length;i++) {
      const j=(i+1)%p.length;
      tris.push(P(i,-16),P(j,16),P(j,-16),P(i,-16),P(i,16),P(j,16));
    }
    for (const [a,b,c] of [[0,1,2],[0,2,5],[2,3,4],[2,4,5]]) {
      tris.push(P(a,-16),P(b,-16),P(c,-16),P(a,16),P(c,16),P(b,16));
    }
    return { vertices: tris, rotationX: 0, sway: false };
  }
  throw new Error('Teste desconhecido.');
}

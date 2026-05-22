const W = {
  'ا':12,'ل':10,'ي':8,'م':7,'ن':7,'و':6,'ر':5,'ت':5,'ه':4,'ب':4,
  'ك':3,'ع':3,'د':3,'س':3,'ف':3,'ق':3,'ح':2,'ج':2,'ش':2,
  'ص':1,'ض':1,'ط':1,'ظ':1,'ذ':1,'ز':1,'ث':1,'خ':1,'غ':1,
};
const L = Object.keys(W);
const cum = [];
let total = 0;
for (const v of Object.values(W)) { total += v; cum.push(total); }
const HIGH = new Set(['ا','ل','ي','م','ن','و','ر','ت']);

function pick() {
  const r = Math.random() * total;
  for (let i = 0; i < cum.length; i++) if (r < cum[i]) return L[i];
  return L[L.length - 1];
}

export function generateGrid(size = 4) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const g = Array.from({ length: size * size }, pick);
    if (g.filter(c => HIGH.has(c)).length >= 3) return g;
  }
  return Array.from({ length: size * size }, pick);
}

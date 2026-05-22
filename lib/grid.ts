import { LETTER_WEIGHTS } from './letters';

const LETTERS = Object.keys(LETTER_WEIGHTS);
const WEIGHTS = Object.values(LETTER_WEIGHTS);
const CUM: number[] = [];
let TOTAL = 0;
for (const w of WEIGHTS) {
  TOTAL += w;
  CUM.push(TOTAL);
}

const HIGH_FREQ = new Set(['ا', 'ل', 'ي', 'م', 'ن', 'و', 'ر', 'ت']);

function pickLetter(rand: () => number): string {
  const r = rand() * TOTAL;
  for (let i = 0; i < CUM.length; i++) {
    if (r < CUM[i]) return LETTERS[i];
  }
  return LETTERS[LETTERS.length - 1];
}

export function generateGrid(size = 4, rand: () => number = Math.random): string[] {
  const n = size * size;
  for (let attempt = 0; attempt < 50; attempt++) {
    const grid = Array.from({ length: n }, () => pickLetter(rand));
    const highCount = grid.filter(c => HIGH_FREQ.has(c)).length;
    if (highCount >= 3) return grid;
  }
  return Array.from({ length: n }, () => pickLetter(rand));
}

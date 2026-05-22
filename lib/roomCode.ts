// 28 chars: no vowels (so codes can't accidentally spell something), no
// confusable glyphs (0/O, 1/I/L). 28^5 ≈ 17M combinations.
export const ROOM_CODE_ALPHABET = 'BCDFGHJKMNPQRSTVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

const ALPHABET_SET = new Set(ROOM_CODE_ALPHABET);

export function generateRoomCode(): string {
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeRoomCodeInput(raw: string): string {
  const upper = raw.toUpperCase();
  let out = '';
  for (const ch of upper) {
    if (ALPHABET_SET.has(ch)) out += ch;
    if (out.length >= ROOM_CODE_LENGTH) break;
  }
  return out;
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) if (!ALPHABET_SET.has(ch)) return false;
  return true;
}

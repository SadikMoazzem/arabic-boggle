const NORMALIZATION_MAP: Record<string, string> = {
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ة': 'ه',
  'ى': 'ي',
  'ؤ': 'و',
  'ئ': 'ي',
  'ء': '',
  'ً': '',
  'ٌ': '',
  'ٍ': '',
  'َ': '',
  'ُ': '',
  'ِ': '',
  'ّ': '',
  'ْ': '',
  'ـ': '',
};

export const BASE_LETTERS = [
  'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر',
  'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف',
  'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي',
] as const;

const BASE_SET = new Set<string>(BASE_LETTERS);

export function normalizeArabic(s: string): string {
  let out = '';
  for (const ch of s) {
    const mapped = NORMALIZATION_MAP[ch];
    const next = mapped !== undefined ? mapped : ch;
    if (next === '' || BASE_SET.has(next)) out += next;
  }
  return out;
}

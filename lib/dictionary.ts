import { normalizeArabic } from './normalize';

export class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isWord = false;
}

export interface Dictionary {
  set: Set<string>;
  root: TrieNode;
}

function insert(root: TrieNode, word: string) {
  let node = root;
  for (const ch of word) {
    let next = node.children.get(ch);
    if (!next) {
      next = new TrieNode();
      node.children.set(ch, next);
    }
    node = next;
  }
  node.isWord = true;
}

let cachePromise: Promise<Dictionary> | null = null;

export function loadDictionary(): Promise<Dictionary> {
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    const res = await fetch('/dict/ar-words.json');
    if (!res.ok) throw new Error(`failed to load dictionary: ${res.status}`);
    const words: string[] = await res.json();
    const set = new Set<string>();
    const root = new TrieNode();
    for (const w of words) {
      const n = normalizeArabic(w);
      if (n.length >= 2) {
        if (!set.has(n)) {
          set.add(n);
          insert(root, n);
        }
      }
    }
    return { set, root };
  })();
  return cachePromise;
}

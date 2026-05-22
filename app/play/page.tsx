'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Grid from '@/components/Grid';
import EndScreen from '@/components/EndScreen';
import { generateGrid } from '@/lib/grid';
import { loadDictionary, type Dictionary } from '@/lib/dictionary';
import { solveBoard } from '@/lib/solver';
import { scoreWord } from '@/lib/score';
import { pathToWord } from '@/lib/path';

interface Found {
  word: string;
  points: number;
}

function PlayInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const duration = Math.max(10, Math.min(600, Number(sp.get('d') ?? '90')));
  const minLength = Math.max(2, Math.min(8, Number(sp.get('m') ?? '3')));

  const [dict, setDict] = useState<Dictionary | null>(null);
  const [dictError, setDictError] = useState<string | null>(null);
  const [grid, setGrid] = useState<string[]>(() => generateGrid(4));
  const [path, setPath] = useState<number[]>([]);
  const [found, setFound] = useState<Found[]>([]);
  const [foundSet, setFoundSet] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(duration);
  const [over, setOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const toastTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadDictionary().then(d => { if (alive) setDict(d); }).catch(e => {
      if (alive) setDictError(String(e));
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (over) return;
    const id = window.setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          window.clearInterval(id);
          setOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [over]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1200);
  }, []);

  const flashWord = useCallback((kind: 'good' | 'bad') => {
    setFlash(kind);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 300);
  }, []);

  const score = useMemo(() => found.reduce((s, f) => s + f.points, 0), [found]);
  const currentWord = useMemo(() => pathToWord(path, grid), [path, grid]);

  const submit = useCallback(() => {
    if (!dict || over) {
      setPath([]);
      return;
    }
    const word = pathToWord(path, grid);
    setPath([]);
    if (word.length < minLength) {
      showToast(`أقل من ${minLength} حروف`);
      flashWord('bad');
      return;
    }
    if (foundSet.has(word)) {
      showToast('مكررة');
      flashWord('bad');
      return;
    }
    if (!dict.set.has(word)) {
      showToast('غير موجودة في القاموس');
      flashWord('bad');
      return;
    }
    const points = scoreWord(word.length);
    setFound(prev => [{ word, points }, ...prev]);
    setFoundSet(prev => new Set(prev).add(word));
    showToast(`+${points}`);
    flashWord('good');
  }, [dict, foundSet, grid, minLength, over, path, showToast, flashWord]);

  const replay = useCallback(() => {
    setGrid(generateGrid(4));
    setPath([]);
    setFound([]);
    setFoundSet(new Set());
    setTimeLeft(duration);
    setOver(false);
  }, [duration]);

  if (dictError) {
    return (
      <main>
        <h2>تعذر تحميل القاموس</h2>
        <p style={{ color: 'var(--text-dim)' }}>{dictError}</p>
        <button className="primary-btn" onClick={() => router.push('/')}>رجوع</button>
      </main>
    );
  }

  if (over && dict) {
    const all = solveBoard(grid, dict.root, minLength, 4);
    const missed = [...all].filter(w => !foundSet.has(w));
    return <EndScreen score={score} found={found} missed={missed} onReplay={replay} />;
  }

  const lowTime = timeLeft <= 10;

  return (
    <main>
      <div className="hud">
        <div className={`timer ${lowTime ? 'low' : ''}`}>
          {String(Math.floor(timeLeft / 60)).padStart(1, '0')}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
        <div className="score">{score} نقطة</div>
      </div>

      <div className={`current-word ${flash ? `flash-${flash}` : ''}`}>
        {currentWord || (dict ? 'اسحب لتكوين كلمة' : 'جاري تحميل القاموس...')}
      </div>

      <Grid
        grid={grid}
        path={path}
        onPathChange={setPath}
        onSubmit={submit}
        disabled={!dict || over}
      />

      <div className="found-list">
        <h3>الكلمات الموجودة ({found.length})</h3>
        <div className="found-words">
          {found.map(f => (
            <span key={f.word} className="found-chip">
              {f.word} <small style={{ color: 'var(--accent)' }}>+{f.points}</small>
            </span>
          ))}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<main><p>جاري التحميل...</p></main>}>
      <PlayInner />
    </Suspense>
  );
}

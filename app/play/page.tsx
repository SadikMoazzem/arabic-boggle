'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Grid from '@/components/Grid';
import { generateGrid } from '@/lib/grid';
import { loadDictionary, type Dictionary } from '@/lib/dictionary';
import { findWordPath, solveBoard } from '@/lib/solver';
import { scoreWord } from '@/lib/score';
import { pathToWord } from '@/lib/path';

interface Found {
  word: string;
  points: number;
}

type GameState = 'countdown' | 'playing' | 'over';

const EMPTY_GRID: string[] = new Array(16).fill('');
const HINT_INTERVAL_MS = 20_000;
const TRACE_STEP_MS = 180;
const TRACE_HOLD_MS = 700;
const COUNTDOWN_FROM = 3;

function PlayInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const duration = Math.max(10, Math.min(600, Number(sp.get('d') ?? '90')));
  const minLength = Math.max(2, Math.min(8, Number(sp.get('m') ?? '3')));

  const [dict, setDict] = useState<Dictionary | null>(null);
  const [dictError, setDictError] = useState<string | null>(null);
  const [grid, setGrid] = useState<string[] | null>(null);
  const [path, setPath] = useState<number[]>([]);
  const [tracedPath, setTracedPath] = useState<number[]>([]);
  const [found, setFound] = useState<Found[]>([]);
  const [foundSet, setFoundSet] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(duration);
  const [gameState, setGameState] = useState<GameState>('countdown');
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);

  const toastTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);
  const traceTimers = useRef<number[]>([]);
  const hintTimer = useRef<number | null>(null);

  useEffect(() => {
    setGrid(generateGrid(4));
  }, []);

  useEffect(() => {
    let alive = true;
    loadDictionary().then(d => { if (alive) setDict(d); }).catch(e => {
      if (alive) setDictError(String(e));
    });
    return () => { alive = false; };
  }, []);

  // Countdown 3 → 2 → 1 → start, but only after grid + dict are ready.
  useEffect(() => {
    if (gameState !== 'countdown' || !grid || !dict) return;
    if (countdown <= 0) {
      setGameState('playing');
      return;
    }
    const id = window.setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [gameState, countdown, grid, dict]);

  // Game timer ticks only while playing.
  useEffect(() => {
    if (gameState !== 'playing') return;
    const id = window.setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          window.clearInterval(id);
          setGameState('over');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [gameState]);

  const cancelTrace = useCallback(() => {
    for (const id of traceTimers.current) window.clearTimeout(id);
    traceTimers.current = [];
  }, []);

  const traceOnGrid = useCallback((wordPath: number[], opts: { hold?: boolean } = {}) => {
    cancelTrace();
    setTracedPath([]);
    for (let i = 0; i < wordPath.length; i++) {
      const id = window.setTimeout(() => {
        setTracedPath(wordPath.slice(0, i + 1));
      }, i * TRACE_STEP_MS);
      traceTimers.current.push(id);
    }
    if (!opts.hold) {
      const clearId = window.setTimeout(() => {
        setTracedPath([]);
      }, wordPath.length * TRACE_STEP_MS + TRACE_HOLD_MS);
      traceTimers.current.push(clearId);
    }
  }, [cancelTrace]);

  // Hint: every HINT_INTERVAL_MS without a new find during play, trace one
  // findable-but-unplayed word. Resets whenever `found` grows.
  useEffect(() => {
    if (gameState !== 'playing' || !grid || !dict) return;
    if (hintTimer.current) window.clearTimeout(hintTimer.current);

    const fireHint = () => {
      const all = solveBoard(grid, dict.root, minLength, 4);
      const candidates: string[] = [];
      for (const w of all) if (!foundSet.has(w)) candidates.push(w);
      if (candidates.length > 0) {
        // Prefer mid-length words for hints — not the shortest or the most
        // overwhelming long one.
        candidates.sort((a, b) => Math.abs(a.length - 4) - Math.abs(b.length - 4));
        const chosen = candidates[0];
        const p = findWordPath(grid, chosen, 4);
        if (p) traceOnGrid(p);
      }
      hintTimer.current = window.setTimeout(fireHint, HINT_INTERVAL_MS);
    };

    hintTimer.current = window.setTimeout(fireHint, HINT_INTERVAL_MS);
    return () => {
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
    };
  }, [gameState, grid, dict, minLength, found.length, foundSet, traceOnGrid]);

  // When the game ends, trace the longest findable word on the grid and
  // keep it visible.
  useEffect(() => {
    if (gameState !== 'over' || !grid || !dict) return;
    const all = solveBoard(grid, dict.root, minLength, 4);
    if (all.size === 0) return;
    const longest = [...all].sort((a, b) => b.length - a.length || a.localeCompare(b))[0];
    const p = findWordPath(grid, longest, 4);
    if (p) traceOnGrid(p, { hold: true });
  }, [gameState, grid, dict, minLength, traceOnGrid]);

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
  const safeGrid = grid ?? EMPTY_GRID;
  const currentWord = useMemo(() => pathToWord(path, safeGrid), [path, safeGrid]);

  const submit = useCallback(() => {
    if (!dict || gameState !== 'playing' || !grid) {
      setPath([]);
      return;
    }
    const word = pathToWord(path, grid);
    setPath([]);
    if (word.length < minLength) {
      showToast(`Need ${minLength}+ letters`);
      flashWord('bad');
      return;
    }
    if (foundSet.has(word)) {
      showToast('Already found');
      flashWord('bad');
      return;
    }
    if (!dict.set.has(word)) {
      showToast('Not in dictionary');
      flashWord('bad');
      return;
    }
    const points = scoreWord(word.length);
    setFound(prev => [{ word, points }, ...prev]);
    setFoundSet(prev => new Set(prev).add(word));
    showToast(`+${points}`);
    flashWord('good');
  }, [dict, foundSet, grid, minLength, gameState, path, showToast, flashWord]);

  const replay = useCallback(() => {
    cancelTrace();
    setTracedPath([]);
    setGrid(generateGrid(4));
    setPath([]);
    setFound([]);
    setFoundSet(new Set());
    setTimeLeft(duration);
    setCountdown(COUNTDOWN_FROM);
    setGameState('countdown');
  }, [duration, cancelTrace]);

  if (dictError) {
    return (
      <main>
        <h2>Couldn&apos;t load the dictionary</h2>
        <p style={{ color: 'var(--text-dim)' }}>{dictError}</p>
        <button className="primary-btn" onClick={() => router.push('/')}>Back</button>
      </main>
    );
  }

  const lowTime = gameState === 'playing' && timeLeft <= 10;
  const placeholder =
    !grid || !dict
      ? 'Loading…'
      : gameState === 'countdown'
      ? 'Get ready…'
      : gameState === 'over'
      ? "Time's up"
      : 'Drag to form a word';

  // End screen computation — done once on game over.
  let missedTop: { word: string; points: number }[] = [];
  if (gameState === 'over' && grid && dict) {
    const all = solveBoard(grid, dict.root, minLength, 4);
    missedTop = [...all]
      .filter(w => !foundSet.has(w))
      .map(w => ({ word: w, points: scoreWord(w.length) }))
      .sort((a, b) => b.points - a.points || b.word.length - a.word.length)
      .slice(0, 10);
  }

  return (
    <main>
      <div className="hud">
        <div className={`timer ${lowTime ? 'low' : ''}`}>
          {gameState === 'over'
            ? '0:00'
            : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
        </div>
        <div className="score">{score} {score === 1 ? 'pt' : 'pts'}</div>
      </div>

      <div
        className={`current-word ${currentWord ? '' : 'placeholder'} ${
          flash ? `flash-${flash}` : ''
        }`}
      >
        {currentWord || placeholder}
      </div>

      <div className="grid-wrap">
        <Grid
          grid={safeGrid}
          path={path}
          tracedPath={tracedPath}
          onPathChange={setPath}
          onSubmit={submit}
          disabled={!dict || !grid || gameState !== 'playing'}
        />
        {gameState === 'countdown' && grid && dict && (
          <div className="countdown-overlay" aria-live="polite">
            <div className="countdown-number">
              {countdown > 0 ? countdown : 'Go!'}
            </div>
          </div>
        )}
      </div>

      {gameState === 'over' ? (
        <>
          <div className="end-summary">
            <div className="end-score">{score}</div>
            <div className="end-score-label">{score === 1 ? 'point' : 'points'}</div>
          </div>

          <div className="found-list">
            <h3>Your words ({found.length})</h3>
            <div className="found-words">
              {found.length === 0 && <span style={{ color: 'var(--text-dim)' }}>None</span>}
              {found.map(f => (
                <span key={f.word} className="found-chip">
                  {f.word} <small style={{ color: 'var(--accent)' }}>+{f.points}</small>
                </span>
              ))}
            </div>
          </div>

          <div className="found-list">
            <h3>Top {missedTop.length} missed</h3>
            <div className="found-words">
              {missedTop.length === 0 && <span style={{ color: 'var(--text-dim)' }}>None</span>}
              {missedTop.map(m => (
                <span key={m.word} className="found-chip">
                  {m.word} <small style={{ color: 'var(--text-dim)' }}>+{m.points}</small>
                </span>
              ))}
            </div>
          </div>

          <button className="primary-btn" onClick={replay} style={{ marginTop: 12 }}>
            New game
          </button>
          <button
            className="primary-btn"
            style={{ background: 'var(--tile)', color: 'var(--text)', marginTop: 8 }}
            onClick={() => router.push('/')}
          >
            Back
          </button>
        </>
      ) : (
        <div className="found-list">
          <h3>Found ({found.length})</h3>
          <div className="found-words">
            {found.map(f => (
              <span key={f.word} className="found-chip">
                {f.word} <small style={{ color: 'var(--accent)' }}>+{f.points}</small>
              </span>
            ))}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<main><p>Loading…</p></main>}>
      <PlayInner />
    </Suspense>
  );
}

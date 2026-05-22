'use client';
import { useRouter } from 'next/navigation';
import { scoreWord } from '@/lib/score';

interface Found {
  word: string;
  points: number;
}

interface Props {
  score: number;
  found: Found[];
  missed: string[];
  onReplay: () => void;
}

export default function EndScreen({ score, found, missed, onReplay }: Props) {
  const router = useRouter();
  const topMissed = [...missed]
    .map(w => ({ word: w, points: scoreWord(w.length) }))
    .sort((a, b) => b.points - a.points || b.word.length - a.word.length)
    .slice(0, 10);

  return (
    <main>
      <div className="end-card">
        <div>Time&apos;s up!</div>
        <div className="end-score">{score}</div>
        <div style={{ color: 'var(--text-dim)' }}>{score === 1 ? 'point' : 'points'}</div>

        <div className="end-section">
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

        <div className="end-section">
          <h3>Top {topMissed.length} missed</h3>
          <div className="found-words">
            {topMissed.length === 0 && (
              <span style={{ color: 'var(--text-dim)' }}>None</span>
            )}
            {topMissed.map(m => (
              <span key={m.word} className="found-chip">
                {m.word} <small style={{ color: 'var(--text-dim)' }}>+{m.points}</small>
              </span>
            ))}
          </div>
        </div>
      </div>

      <button className="primary-btn" onClick={onReplay} style={{ marginBottom: 12 }}>
        New game
      </button>
      <button
        className="primary-btn"
        style={{ background: 'var(--tile)', color: 'var(--text)' }}
        onClick={() => router.push('/')}
      >
        Back
      </button>
    </main>
  );
}

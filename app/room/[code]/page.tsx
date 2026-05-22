'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import Header from '@/components/Header';
import Grid from '@/components/Grid';
import { getNickname, getOrCreatePid, saveNickname } from '@/lib/identity';
import { isValidRoomCode, normalizeRoomCodeInput } from '@/lib/roomCode';
import {
  type PlayerPublic,
  type ServerStateMsg,
  type WordResult,
  type RoundEndPayload,
  useRoomConnection,
} from '@/lib/multiplayerClient';
import { findWordPath } from '@/lib/solver';
import { pathToWord } from '@/lib/path';

const DURATIONS = [60, 90, 180];
const MIN_LENGTHS = [3, 4];

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ code: string | string[] }>();
  const rawCode = Array.isArray(params?.code) ? params.code[0] : params?.code ?? '';
  const code = normalizeRoomCodeInput(rawCode ?? '');

  const [pid, setPid] = useState('');
  const [nickname, setNick] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    setPid(getOrCreatePid());
    setNick(getNickname());
    if (typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/room/${code}`);
    }
  }, [code]);

  const enabled = !!nickname && !!pid && isValidRoomCode(code);

  const { state, status, lastResult, endPayload, send, clearLastResult } =
    useRoomConnection({ code, pid, nickname: nickname ?? '', enabled });

  if (!isValidRoomCode(code)) {
    return (
      <>
        <Header />
        <main>
          <h1>Invalid room code</h1>
          <p style={{ color: 'var(--text-dim)' }}>
            That code doesn&apos;t look right. Codes are 5 characters long.
          </p>
          <button className="primary-btn" onClick={() => router.push('/room/join')}>
            Try again
          </button>
        </main>
      </>
    );
  }

  if (!nickname) {
    return (
      <>
        <Header />
        <main>
          <h1>Lobby</h1>
          <RoomCodeDisplay code={code} />
          <div className="setup-card">
            <div className="setup-row">
              <label htmlFor="nickname">Your nickname</label>
              <input
                id="nickname"
                className="text-input"
                value={nameInput}
                onChange={e => setNameInput(e.target.value.slice(0, 12))}
                maxLength={12}
                autoFocus
                placeholder="e.g. Sadik"
              />
            </div>
            <button
              className="primary-btn"
              onClick={() => {
                const trimmed = nameInput.trim();
                if (!trimmed) return;
                saveNickname(trimmed);
                setNick(trimmed.slice(0, 12));
              }}
              disabled={nameInput.trim().length === 0}
            >
              Continue
            </button>
          </div>
        </main>
      </>
    );
  }

  if (status === 'connecting' && !state) {
    return (
      <>
        <Header />
        <main>
          <h1>Connecting…</h1>
          <p style={{ color: 'var(--text-dim)' }}>Joining room <strong>{code}</strong>.</p>
        </main>
      </>
    );
  }

  if (status === 'error' || (status === 'closed' && !state)) {
    return (
      <>
        <Header />
        <main>
          <h1>Connection failed</h1>
          <p style={{ color: 'var(--text-dim)' }}>
            Couldn&apos;t reach the room server. Make sure the multiplayer server is
            running (<code>npm run pk:dev</code>) or check your network.
          </p>
          <button className="primary-btn" onClick={() => router.push('/')}>Back home</button>
        </main>
      </>
    );
  }

  if (!state) {
    return (
      <>
        <Header />
        <main><h1>Loading…</h1></main>
      </>
    );
  }

  const self = state.players.find(p => p.pid === state.selfPid) ?? null;
  const isHost = !!self?.isHost;

  return (
    <>
      <Header />
      {state.phase === 'lobby' && (
        <LobbyView
          code={code}
          shareUrl={shareUrl}
          state={state}
          isHost={isHost}
          onStart={(d, m) => send({ type: 'startRound', duration: d, minLength: m })}
          onLeave={() => router.push('/')}
        />
      )}
      {(state.phase === 'countdown' || state.phase === 'playing') && (
        <PlayView
          state={state}
          lastResult={lastResult}
          clearLastResult={clearLastResult}
          onSubmitPath={path => send({ type: 'submitPath', path })}
        />
      )}
      {state.phase === 'over' && (
        <EndView
          state={state}
          endPayload={endPayload}
          isHost={isHost}
          onPlayAgain={() => send({ type: 'playAgain' })}
          onLeave={() => router.push('/')}
        />
      )}
    </>
  );
}

// ---------------- Lobby view ----------------
function RoomCodeDisplay({ code }: { code: string }) {
  return (
    <div className="room-code" aria-label={`Room code ${code}`}>
      {code.split('').map((c, i) => (
        <span key={i} className="room-code-char">{c}</span>
      ))}
    </div>
  );
}

interface LobbyProps {
  code: string;
  shareUrl: string;
  state: ServerStateMsg;
  isHost: boolean;
  onStart: (duration: number, minLength: number) => void;
  onLeave: () => void;
}

function LobbyView({ code, shareUrl, state, isHost, onStart, onLeave }: LobbyProps) {
  const [duration, setDuration] = useState(state.duration);
  const [minLength, setMinLength] = useState(state.minLength);

  return (
    <main>
      <h1>Lobby</h1>
      <RoomCodeDisplay code={code} />

      <div className="lobby-card">
        <h3>Scan or share to invite</h3>
        <div className="qr-wrap">
          {shareUrl && (
            <QRCodeSVG value={shareUrl} size={176} bgColor="#1e293b" fgColor="#f1f5f9" level="M" />
          )}
        </div>
        <div className="share-url" title={shareUrl}>{shareUrl}</div>
      </div>

      <div className="lobby-card">
        <h3>Players ({state.players.length})</h3>
        <ul className="member-list">
          {state.players.map(p => (
            <li key={p.pid} className="member">
              <span className="nickname">
                {p.nickname}
                {p.pid === state.selfPid && <span className="you-tag"> (you)</span>}
              </span>
              {p.isHost && <span className="host-badge">Host</span>}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <div className="lobby-card">
          <h3>Round settings</h3>
          <div className="setup-row">
            <label>Duration (seconds)</label>
            <div className="choice-group">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  className={`choice ${duration === d ? 'active' : ''}`}
                  onClick={() => setDuration(d)}
                >{d}</button>
              ))}
            </div>
          </div>
          <div className="setup-row">
            <label>Minimum word length</label>
            <div className="choice-group">
              {MIN_LENGTHS.map(m => (
                <button
                  key={m}
                  className={`choice ${minLength === m ? 'active' : ''}`}
                  onClick={() => setMinLength(m)}
                >{m}</button>
              ))}
            </div>
          </div>
          <button
            className="primary-btn"
            onClick={() => onStart(duration, minLength)}
          >
            Start round
          </button>
        </div>
      ) : (
        <div className="lobby-hint" style={{ textAlign: 'center', margin: '16px 0' }}>
          Waiting for the host to start the round…
        </div>
      )}
      <button
        className="primary-btn"
        style={{ background: 'var(--tile)', color: 'var(--text)', marginTop: 8 }}
        onClick={onLeave}
      >
        Leave
      </button>
    </main>
  );
}

// ---------------- Play view ----------------
interface PlayProps {
  state: ServerStateMsg;
  lastResult: WordResult | null;
  clearLastResult: () => void;
  onSubmitPath: (path: number[]) => void;
}

function PlayView({ state, lastResult, clearLastResult, onSubmitPath }: PlayProps) {
  const [path, setPath] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const grid = state.grid ?? new Array(16).fill('');
  const currentWord = useMemo(() => pathToWord(path, grid), [path, grid]);

  // Live countdown / timer driven by server-broadcast deadlines.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      if (state.phase === 'countdown' && state.countdownEndMs) {
        setCountdown(Math.max(0, Math.ceil((state.countdownEndMs - now) / 1000)));
      }
      if (state.roundEndMs) {
        setTimeLeft(Math.max(0, Math.ceil((state.roundEndMs - now) / 1000)));
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [state.phase, state.countdownEndMs, state.roundEndMs]);

  // Show toast/flash for the most recent server response.
  useEffect(() => {
    if (!lastResult) return;
    if (lastResult.ok) {
      setToast(`+${lastResult.points}`);
      setFlash('good');
    } else {
      setToast(lastResult.reason ?? 'Rejected');
      setFlash('bad');
    }
    const t1 = window.setTimeout(() => setToast(null), 1200);
    const t2 = window.setTimeout(() => setFlash(null), 300);
    const t3 = window.setTimeout(() => clearLastResult(), 1300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [lastResult, clearLastResult]);

  const self = state.players.find(p => p.pid === state.selfPid);
  const myScore = self?.score ?? 0;
  const sortedScores = [...state.players].sort((a, b) => b.score - a.score);

  return (
    <main>
      <div className="hud">
        <div className={`timer ${timeLeft <= 10 ? 'low' : ''}`}>
          {state.phase === 'countdown'
            ? `${Math.floor(state.duration / 60)}:${String(state.duration % 60).padStart(2, '0')}`
            : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
        </div>
        <div className="score">{myScore} {myScore === 1 ? 'pt' : 'pts'}</div>
      </div>

      <div
        className={`current-word ${currentWord ? '' : 'placeholder'} ${
          flash ? `flash-${flash}` : ''
        }`}
      >
        {currentWord || (state.phase === 'countdown' ? 'Get ready…' : 'Drag to form a word')}
      </div>

      <div className="grid-wrap">
        <Grid
          grid={grid}
          path={path}
          onPathChange={setPath}
          onSubmit={() => {
            if (path.length > 0) onSubmitPath(path);
            setPath([]);
          }}
          disabled={state.phase !== 'playing'}
        />
        {state.phase === 'countdown' && countdown > 0 && (
          <div className="countdown-overlay" aria-live="polite">
            <div className="countdown-number">{countdown}</div>
          </div>
        )}
      </div>

      <div className="found-list">
        <h3>Live scores</h3>
        <ul className="member-list">
          {sortedScores.map(p => (
            <li key={p.pid} className="member">
              <span className="nickname">
                {p.nickname}
                {p.pid === state.selfPid && <span className="you-tag"> (you)</span>}
              </span>
              <span className="score-pill">
                {p.score} {p.score === 1 ? 'pt' : 'pts'}
                <small style={{ marginLeft: 6, color: 'var(--text-dim)' }}>{p.wordCount}w</small>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="found-list">
        <h3>Your finds ({state.selfWords.length})</h3>
        <div className="found-words">
          {state.selfWords.map(w => (
            <span key={w} className="found-chip">{w}</span>
          ))}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

// ---------------- End view ----------------
interface EndProps {
  state: ServerStateMsg;
  endPayload: RoundEndPayload | null;
  isHost: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

function EndView({ state, endPayload, isHost, onPlayAgain, onLeave }: EndProps) {
  const leaderboard: PlayerPublic[] = endPayload?.leaderboard ?? [...state.players].sort((a, b) => b.score - a.score);
  const grid = endPayload?.grid ?? state.grid ?? new Array(16).fill('');
  const fullSolution = endPayload?.fullSolution ?? [];
  const winner = leaderboard[0];
  const tracedPath = useTraceLongest(grid, fullSolution);

  return (
    <main>
      <div className="hud">
        <div className="timer">0:00</div>
        <div className="score">Round over</div>
      </div>

      <div className={'current-word placeholder'}>
        {winner ? `Winner: ${winner.nickname} — ${winner.score} ${winner.score === 1 ? 'pt' : 'pts'}` : "Time's up"}
      </div>

      <div className="grid-wrap">
        <Grid
          grid={grid}
          path={[]}
          tracedPath={tracedPath}
          onPathChange={() => {}}
          onSubmit={() => {}}
          disabled
        />
      </div>

      <div className="found-list">
        <h3>Leaderboard</h3>
        <ul className="member-list">
          {leaderboard.map((p, i) => (
            <li key={p.pid} className="member">
              <span className="nickname">
                <span className="rank">{i + 1}.</span> {p.nickname}
                {p.pid === state.selfPid && <span className="you-tag"> (you)</span>}
              </span>
              <span className="score-pill">
                {p.score} {p.score === 1 ? 'pt' : 'pts'}
                <small style={{ marginLeft: 6, color: 'var(--text-dim)' }}>{p.wordCount}w</small>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <button className="primary-btn" onClick={onPlayAgain} style={{ marginTop: 12 }}>
          Play again
        </button>
      ) : (
        <div className="lobby-hint" style={{ textAlign: 'center', margin: '12px 0' }}>
          Waiting for the host to start another round…
        </div>
      )}
      <button
        className="primary-btn"
        style={{ background: 'var(--tile)', color: 'var(--text)', marginTop: 8 }}
        onClick={onLeave}
      >
        Leave
      </button>
    </main>
  );
}

// ---------------- Hook: animate the longest word on the end grid ----------------
function useTraceLongest(grid: string[], fullSolution: string[]) {
  const [tracedPath, setTracedPath] = useState<number[]>([]);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    // Clean any previous animation.
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
    setTracedPath([]);

    if (grid.length === 0 || fullSolution.length === 0) return;
    const longest = [...fullSolution].sort((a, b) => b.length - a.length || a.localeCompare(b))[0];
    const p = findWordPath(grid, longest, 4);
    if (!p) return;

    const STEP = 180;
    for (let i = 0; i < p.length; i++) {
      const id = window.setTimeout(() => setTracedPath(p.slice(0, i + 1)), i * STEP);
      timersRef.current.push(id);
    }
    return () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    };
  }, [grid, fullSolution]);

  return tracedPath;
}


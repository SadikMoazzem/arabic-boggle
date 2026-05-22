'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import Header from '@/components/Header';
import { getNickname, getOrCreatePid, saveNickname } from '@/lib/identity';
import { isValidRoomCode, normalizeRoomCodeInput } from '@/lib/roomCode';

interface SessionInfo {
  host?: boolean;
  duration?: number;
  minLength?: number;
}

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams<{ code: string | string[] }>();
  const rawCode = Array.isArray(params?.code) ? params.code[0] : params?.code ?? '';
  const code = normalizeRoomCodeInput(rawCode ?? '');

  const [pid, setPid] = useState('');
  const [nickname, setNick] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [session, setSession] = useState<SessionInfo>({});
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    setPid(getOrCreatePid());
    setNick(getNickname());
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem(`room:${code}`);
    if (raw) {
      try { setSession(JSON.parse(raw)); } catch { setSession({}); }
    }
    setShareUrl(`${window.location.origin}/room/${code}`);
  }, [code]);

  const isHost = !!session.host;

  const members = useMemo(() => (
    nickname ? [{ id: pid, nick: nickname, isHost }] : []
  ), [nickname, pid, isHost]);

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

  function handleSetNickname() {
    const trimmed = nameInput.trim();
    if (trimmed.length === 0) return;
    saveNickname(trimmed);
    setNick(trimmed.slice(0, 12));
  }

  return (
    <>
      <Header />
      <main>
        <h1>Lobby</h1>
        <div className="room-code" aria-label={`Room code ${code}`}>
          {code.split('').map((c, i) => (
            <span key={i} className="room-code-char">{c}</span>
          ))}
        </div>

        {!nickname ? (
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
              onClick={handleSetNickname}
              disabled={nameInput.trim().length === 0}
            >
              Continue
            </button>
          </div>
        ) : (
          <>
            <div className="lobby-card">
              <h3>Scan or share to invite</h3>
              <div className="qr-wrap">
                {shareUrl && (
                  <QRCodeSVG
                    value={shareUrl}
                    size={176}
                    bgColor="#1e293b"
                    fgColor="#f1f5f9"
                    level="M"
                  />
                )}
              </div>
              <div className="share-url" title={shareUrl}>{shareUrl}</div>
            </div>

            <div className="lobby-card">
              <h3>Players ({members.length})</h3>
              <ul className="member-list">
                {members.map(m => (
                  <li key={m.id} className="member">
                    <span className="nickname">{m.nick}</span>
                    {m.isHost && <span className="host-badge">Host</span>}
                  </li>
                ))}
              </ul>
              <p className="lobby-hint">
                {isHost
                  ? 'You are the host. Multiplayer sync ships in the next push — for now this lobby is local.'
                  : 'Joined locally. Multiplayer sync ships in the next push.'}
              </p>
            </div>

            {isHost && (
              <button className="primary-btn" disabled aria-disabled>
                Start round (server coming soon)
              </button>
            )}
            <button
              className="primary-btn"
              style={{ background: 'var(--tile)', color: 'var(--text)', marginTop: 8 }}
              onClick={() => router.push('/')}
            >
              Leave
            </button>
          </>
        )}
      </main>
    </>
  );
}

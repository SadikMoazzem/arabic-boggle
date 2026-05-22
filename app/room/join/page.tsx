'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import {
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  normalizeRoomCodeInput,
} from '@/lib/roomCode';

export default function RoomJoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function handleChange(v: string) {
    setCode(normalizeRoomCodeInput(v));
    setErr(null);
  }

  function handleSubmit() {
    if (!isValidRoomCode(code)) {
      setErr(`Code must be ${ROOM_CODE_LENGTH} characters`);
      return;
    }
    router.push(`/room/${code}`);
  }

  return (
    <>
      <Header />
      <main>
        <h1>Join a room</h1>
        <p className="subtitle">Enter the {ROOM_CODE_LENGTH}-character code from the host.</p>
        <div className="setup-card">
          <input
            className="code-input"
            value={code}
            onChange={e => handleChange(e.target.value)}
            placeholder="ABCDE"
            maxLength={ROOM_CODE_LENGTH}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label="Room code"
          />
          {err && <div className="error-text">{err}</div>}
          <button
            className="primary-btn"
            onClick={handleSubmit}
            disabled={!isValidRoomCode(code)}
          >
            Join
          </button>
        </div>
      </main>
    </>
  );
}

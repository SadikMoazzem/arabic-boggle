'use client';
import { useEffect, useRef, useState } from 'react';
import PartySocket from 'partysocket';

export type Phase = 'lobby' | 'countdown' | 'playing' | 'over';

export interface PlayerPublic {
  pid: string;
  nickname: string;
  isHost: boolean;
  score: number;
  wordCount: number;
  connected: boolean;
}

export interface RoundEndPayload {
  leaderboard: PlayerPublic[];
  grid: string[];
  fullSolution: string[];
}

export interface ServerStateMsg {
  type: 'state';
  phase: Phase;
  players: PlayerPublic[];
  minLength: number;
  duration: number;
  grid: string[] | null;
  countdownEndMs: number | null;
  roundEndMs: number | null;
  selfPid: string;
  selfWords: string[];
}

export interface WordResult {
  pid: string;
  word: string;
  ok: boolean;
  reason?: string;
  points?: number;
  totalScore?: number;
}

export type ClientMsg =
  | { type: 'hello'; pid: string; nickname: string }
  | { type: 'setNickname'; nickname: string }
  | { type: 'startRound'; duration: number; minLength: number }
  | { type: 'submitPath'; path: number[] }
  | { type: 'playAgain' };

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

interface UseRoomOptions {
  code: string;
  pid: string;
  nickname: string;
  enabled: boolean;
}

interface RoomHandle {
  state: ServerStateMsg | null;
  status: ConnectionStatus;
  lastResult: WordResult | null;
  endPayload: RoundEndPayload | null;
  send: (msg: ClientMsg) => void;
  clearLastResult: () => void;
}

function getPartyHost(): string {
  if (typeof window === 'undefined') return 'localhost:1999';
  const env = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  return env && env.length > 0 ? env : `${window.location.hostname}:1999`;
}

export function useRoomConnection({ code, pid, nickname, enabled }: UseRoomOptions): RoomHandle {
  const [state, setState] = useState<ServerStateMsg | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastResult, setLastResult] = useState<WordResult | null>(null);
  const [endPayload, setEndPayload] = useState<RoundEndPayload | null>(null);
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    if (!enabled || !code || !pid) return;
    const socket = new PartySocket({
      host: getPartyHost(),
      room: code.toLowerCase(),
      query: { pid, nickname },
    });
    socketRef.current = socket;

    const onOpen = () => setStatus('open');
    const onClose = () => setStatus('closed');
    const onError = () => setStatus('error');
    const onMessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'state': setState(msg); if (msg.phase !== 'over') setEndPayload(null); break;
          case 'wordResult': setLastResult(msg); break;
          case 'roundEnd': setEndPayload(msg.payload); break;
          case 'error': console.warn('Room error:', msg.message); break;
        }
      } catch {}
    };

    socket.addEventListener('open', onOpen);
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onError);
    socket.addEventListener('message', onMessage);

    return () => {
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('close', onClose);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('message', onMessage);
      socket.close();
      socketRef.current = null;
    };
  }, [code, pid, nickname, enabled]);

  return {
    state,
    status,
    lastResult,
    endPayload,
    send: (msg: ClientMsg) => {
      const s = socketRef.current;
      if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(msg));
    },
    clearLastResult: () => setLastResult(null),
  };
}

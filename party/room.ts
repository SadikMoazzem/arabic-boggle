import type * as Party from 'partykit/server';
import wordsRaw from '../public/dict/ar-words.json';
import { normalizeArabic } from '../lib/normalize';
import { generateGrid } from '../lib/grid';
import { isAdjacent } from '../lib/path';
import { scoreWord } from '../lib/score';

// ---------- Module-level dictionary (loaded once per server instance) ----------
const DICT: Set<string> = (() => {
  const s = new Set<string>();
  for (const w of wordsRaw as string[]) {
    const n = normalizeArabic(w);
    if (n.length >= 2) s.add(n);
  }
  return s;
})();

// ---------- Wire protocol ----------
type ClientMsg =
  | { type: 'hello'; pid: string; nickname: string }
  | { type: 'setNickname'; nickname: string }
  | { type: 'startRound'; duration: number; minLength: number }
  | { type: 'submitPath'; path: number[] }
  | { type: 'playAgain' };

interface PlayerPublic {
  pid: string;
  nickname: string;
  isHost: boolean;
  score: number;
  wordCount: number;
  connected: boolean;
}

type Phase = 'lobby' | 'countdown' | 'playing' | 'over';

interface RoundEndPayload {
  leaderboard: PlayerPublic[];
  grid: string[];
  fullSolution: string[];
}

type ServerMsg =
  | { type: 'state'; phase: Phase; players: PlayerPublic[]; minLength: number; duration: number; grid: string[] | null; countdownEndMs: number | null; roundEndMs: number | null; selfPid: string; selfWords: string[] }
  | { type: 'wordResult'; pid: string; word: string; ok: boolean; reason?: string; points?: number; totalScore?: number }
  | { type: 'roundEnd'; payload: RoundEndPayload }
  | { type: 'error'; message: string };

// ---------- Internal state ----------
interface PlayerInternal {
  pid: string;
  connId: string | null;
  nickname: string;
  isHost: boolean;
  score: number;
  found: Set<string>;
  joinedAt: number;
}

const COUNTDOWN_MS = 3000;
const MAX_PLAYERS = 8;
const NICKNAME_MAX = 12;

function sanitizeNickname(raw: string): string {
  return raw.trim().slice(0, NICKNAME_MAX) || 'Player';
}

export default class RoomServer implements Party.Server {
  phase: Phase = 'lobby';
  grid: string[] | null = null;
  duration = 90;
  minLength = 3;
  countdownEndMs: number | null = null;
  roundEndMs: number | null = null;
  players: Map<string, PlayerInternal> = new Map(); // keyed by pid
  connIdToPid: Map<string, string> = new Map();

  // Server-side timers (alarm via setTimeout in the DO)
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private roundEndTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly room: Party.Room) {}

  // ---------- Connection lifecycle ----------
  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const pid = url.searchParams.get('pid') ?? '';
    const nickname = sanitizeNickname(url.searchParams.get('nickname') ?? 'Player');
    if (!pid) {
      conn.send(JSON.stringify({ type: 'error', message: 'missing pid' } satisfies ServerMsg));
      conn.close();
      return;
    }

    const existing = this.players.get(pid);
    if (existing) {
      // Reconnect: reuse slot
      existing.connId = conn.id;
      existing.nickname = nickname;
      this.connIdToPid.set(conn.id, pid);
    } else {
      if (this.players.size >= MAX_PLAYERS) {
        conn.send(JSON.stringify({ type: 'error', message: 'room full' } satisfies ServerMsg));
        conn.close();
        return;
      }
      const isHost = !this.hasAnyHost();
      this.players.set(pid, {
        pid,
        connId: conn.id,
        nickname,
        isHost,
        score: 0,
        found: new Set(),
        joinedAt: Date.now(),
      });
      this.connIdToPid.set(conn.id, pid);
    }
    this.broadcastState();
  }

  async onClose(conn: Party.Connection) {
    const pid = this.connIdToPid.get(conn.id);
    if (!pid) return;
    this.connIdToPid.delete(conn.id);
    const player = this.players.get(pid);
    if (!player) return;
    // Mark as disconnected; in lobby phase, also drop them from the room.
    player.connId = null;
    if (this.phase === 'lobby') {
      this.players.delete(pid);
      this.maybePromoteHost();
    } else if (player.isHost) {
      // Host left mid-round → promote someone else so the next host CTA works.
      player.isHost = false;
      this.maybePromoteHost();
    }
    this.broadcastState();
  }

  async onMessage(raw: string, conn: Party.Connection) {
    let msg: ClientMsg;
    try { msg = JSON.parse(raw) as ClientMsg; } catch { return; }
    const pid = this.connIdToPid.get(conn.id);
    if (!pid) return;
    const player = this.players.get(pid);
    if (!player) return;

    switch (msg.type) {
      case 'hello':
        // Already handled on connect via query params; no-op.
        break;
      case 'setNickname':
        player.nickname = sanitizeNickname(msg.nickname);
        this.broadcastState();
        break;
      case 'startRound':
        if (!player.isHost) return;
        if (this.phase !== 'lobby' && this.phase !== 'over') return;
        this.startRound(msg.duration, msg.minLength);
        break;
      case 'submitPath':
        if (this.phase !== 'playing') return;
        this.handleSubmission(player, msg.path);
        break;
      case 'playAgain':
        if (!player.isHost) return;
        if (this.phase !== 'over') return;
        this.resetToLobby();
        break;
    }
  }

  // ---------- Game phases ----------
  private startRound(duration: number, minLength: number) {
    this.duration = Math.max(10, Math.min(600, Math.round(duration)));
    this.minLength = Math.max(2, Math.min(8, Math.round(minLength)));
    this.grid = generateGrid(4);
    for (const p of this.players.values()) {
      p.score = 0;
      p.found = new Set();
    }

    const now = Date.now();
    this.countdownEndMs = now + COUNTDOWN_MS;
    this.roundEndMs = this.countdownEndMs + this.duration * 1000;
    this.phase = 'countdown';
    this.broadcastState();

    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownTimer = setTimeout(() => {
      this.phase = 'playing';
      this.broadcastState();
    }, COUNTDOWN_MS);

    if (this.roundEndTimer) clearTimeout(this.roundEndTimer);
    this.roundEndTimer = setTimeout(() => {
      this.endRound();
    }, COUNTDOWN_MS + this.duration * 1000);
  }

  private endRound() {
    this.phase = 'over';
    this.roundEndMs = Date.now();
    const grid = this.grid ?? [];
    const fullSolution = this.solveFullBoard(grid);
    const payload: RoundEndPayload = {
      leaderboard: this.publicPlayers().sort((a, b) => b.score - a.score),
      grid,
      fullSolution,
    };
    this.broadcast({ type: 'roundEnd', payload });
    this.broadcastState();
  }

  private resetToLobby() {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    if (this.roundEndTimer) clearTimeout(this.roundEndTimer);
    this.countdownTimer = null;
    this.roundEndTimer = null;
    this.phase = 'lobby';
    this.grid = null;
    this.countdownEndMs = null;
    this.roundEndMs = null;
    for (const p of this.players.values()) {
      p.score = 0;
      p.found = new Set();
    }
    this.broadcastState();
  }

  // ---------- Validation ----------
  private handleSubmission(player: PlayerInternal, path: number[]) {
    const grid = this.grid;
    if (!grid) return;
    if (!Array.isArray(path) || path.length === 0) return;
    // 1. Adjacency + no-repeat.
    const seen = new Set<number>();
    for (let i = 0; i < path.length; i++) {
      const idx = path[i];
      if (typeof idx !== 'number' || idx < 0 || idx >= grid.length) return;
      if (seen.has(idx)) return;
      seen.add(idx);
      if (i > 0 && !isAdjacent(path[i - 1], idx, 4)) return;
    }
    const word = path.map(i => grid[i]).join('');
    if (word.length < this.minLength) {
      this.sendTo(player, { type: 'wordResult', pid: player.pid, word, ok: false, reason: `Need ${this.minLength}+ letters` });
      return;
    }
    if (player.found.has(word)) {
      this.sendTo(player, { type: 'wordResult', pid: player.pid, word, ok: false, reason: 'Already found' });
      return;
    }
    if (!DICT.has(word)) {
      this.sendTo(player, { type: 'wordResult', pid: player.pid, word, ok: false, reason: 'Not in dictionary' });
      return;
    }
    const points = scoreWord(word.length);
    player.found.add(word);
    player.score += points;
    // Tell the submitter the points + word; broadcast a slimmer signal to
    // others so they can see scores update but not spoiler the word itself.
    this.sendTo(player, {
      type: 'wordResult',
      pid: player.pid,
      word,
      ok: true,
      points,
      totalScore: player.score,
    });
    // Push the public state so everyone sees the new score and wordCount.
    this.broadcastState();
  }

  // ---------- Helpers ----------
  private hasAnyHost(): boolean {
    for (const p of this.players.values()) if (p.isHost) return true;
    return false;
  }

  private maybePromoteHost() {
    if (this.hasAnyHost()) return;
    const next = [...this.players.values()]
      .filter(p => p.connId)
      .sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (next) next.isHost = true;
  }

  private publicPlayers(): PlayerPublic[] {
    return [...this.players.values()].map(p => ({
      pid: p.pid,
      nickname: p.nickname,
      isHost: p.isHost,
      score: p.score,
      wordCount: p.found.size,
      connected: p.connId !== null,
    }));
  }

  private broadcastState() {
    for (const p of this.players.values()) {
      if (!p.connId) continue;
      const conn = this.room.getConnection(p.connId);
      if (!conn) continue;
      const msg: ServerMsg = {
        type: 'state',
        phase: this.phase,
        players: this.publicPlayers(),
        minLength: this.minLength,
        duration: this.duration,
        grid: this.grid,
        countdownEndMs: this.countdownEndMs,
        roundEndMs: this.roundEndMs,
        selfPid: p.pid,
        selfWords: [...p.found],
      };
      conn.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: ServerMsg) {
    const str = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (!p.connId) continue;
      const conn = this.room.getConnection(p.connId);
      if (conn) conn.send(str);
    }
  }

  private sendTo(player: PlayerInternal, msg: ServerMsg) {
    if (!player.connId) return;
    const conn = this.room.getConnection(player.connId);
    if (conn) conn.send(JSON.stringify(msg));
  }

  // ---------- Solver (full board) ----------
  private solveFullBoard(grid: string[]): string[] {
    if (grid.length === 0) return [];
    const found = new Set<string>();
    const used = new Array<boolean>(grid.length).fill(false);
    const size = 4;
    const neighbors = (idx: number): number[] => {
      const r = Math.floor(idx / size);
      const c = idx % size;
      const out: number[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push(nr * size + nc);
        }
      }
      return out;
    };

    // Lazy prefix index: we just call DICT.has on each candidate. For 4x4
    // boards this is fast enough without a separate Trie.
    const minLen = this.minLength;
    const dfs = (idx: number, prefix: string) => {
      used[idx] = true;
      const next = prefix + grid[idx];
      if (next.length >= minLen && DICT.has(next)) found.add(next);
      if (next.length < 12) {
        for (const nb of neighbors(idx)) {
          if (!used[nb]) dfs(nb, next);
        }
      }
      used[idx] = false;
    };
    for (let i = 0; i < grid.length; i++) dfs(i, '');
    return [...found];
  }
}

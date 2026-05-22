const PID_KEY = 'arabic-boggle.pid';
const NICK_KEY = 'arabic-boggle.nickname';

export function getOrCreatePid(): string {
  if (typeof window === 'undefined') return '';
  let pid = window.localStorage.getItem(PID_KEY);
  if (!pid) {
    pid = (crypto.randomUUID?.() ?? `pid_${Math.random().toString(36).slice(2)}_${Date.now()}`);
    window.localStorage.setItem(PID_KEY, pid);
  }
  return pid;
}

export function getNickname(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(NICK_KEY);
}

export function saveNickname(name: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NICK_KEY, name.trim().slice(0, 12));
}

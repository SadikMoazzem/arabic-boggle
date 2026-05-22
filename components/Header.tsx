'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <header className="app-header">
        <Link href="/" className="app-title">
          <span className="app-title-mark">ب</span>
          <span>
            Arabic<span className="app-title-accent">Boggle</span>
          </span>
        </Link>
        <button
          className="menu-btn"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
        >
          <span aria-hidden>☰</span>
        </button>
      </header>
      {open && (
        <div className="menu-overlay" onClick={() => setOpen(false)} role="presentation">
          <nav
            className="menu"
            onClick={e => e.stopPropagation()}
            aria-label="Main menu"
          >
            <button
              className="menu-close"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              ×
            </button>
            <Link href="/solo" onClick={() => setOpen(false)}>Solo</Link>
            <Link href="/room/new" onClick={() => setOpen(false)}>Start a room</Link>
            <Link href="/room/join" onClick={() => setOpen(false)}>Join a room</Link>
            <Link href="/" onClick={() => setOpen(false)}>Home</Link>
          </nav>
        </div>
      )}
    </>
  );
}

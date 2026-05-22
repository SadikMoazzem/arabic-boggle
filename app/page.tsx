'use client';
import Link from 'next/link';
import Header from '@/components/Header';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <div className="home-hero">
          <h1>Find words. Race friends.</h1>
          <p className="subtitle">Arabic Boggle on a 4×4 board.</p>
        </div>

        <div className="home-actions">
          <Link className="home-cta primary" href="/solo">
            <span className="home-cta-icon" aria-hidden>◐</span>
            <span className="home-cta-body">
              <span className="home-cta-title">Solo</span>
              <span className="home-cta-sub">Practice alone against the clock</span>
            </span>
            <span className="home-cta-arrow" aria-hidden>→</span>
          </Link>
          <Link className="home-cta" href="/room/new">
            <span className="home-cta-icon" aria-hidden>＋</span>
            <span className="home-cta-body">
              <span className="home-cta-title">Start a room</span>
              <span className="home-cta-sub">Host a game and invite friends</span>
            </span>
            <span className="home-cta-arrow" aria-hidden>→</span>
          </Link>
          <Link className="home-cta" href="/room/join">
            <span className="home-cta-icon" aria-hidden>↦</span>
            <span className="home-cta-body">
              <span className="home-cta-title">Join a room</span>
              <span className="home-cta-sub">Enter a 5-character code</span>
            </span>
            <span className="home-cta-arrow" aria-hidden>→</span>
          </Link>
        </div>
      </main>
    </>
  );
}

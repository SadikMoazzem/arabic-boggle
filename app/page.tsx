'use client';
import Link from 'next/link';
import Header from '@/components/Header';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <div className="home-hero">
          <h1>Arabic Boggle</h1>
          <p className="subtitle">Find as many Arabic words as you can on a 4×4 board</p>
        </div>

        <div className="home-actions">
          <Link className="home-cta primary" href="/solo">
            <div className="home-cta-title">Solo</div>
            <div className="home-cta-sub">Practice alone against the clock</div>
          </Link>
          <Link className="home-cta" href="/room/new">
            <div className="home-cta-title">Start a room</div>
            <div className="home-cta-sub">Host a game and invite friends</div>
          </Link>
          <Link className="home-cta" href="/room/join">
            <div className="home-cta-title">Join a room</div>
            <div className="home-cta-sub">Enter a 5-character code</div>
          </Link>
        </div>
      </main>
    </>
  );
}

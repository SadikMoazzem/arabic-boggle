'use client';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import RoundSetup from '@/components/RoundSetup';

export default function SoloSetupPage() {
  const router = useRouter();
  return (
    <>
      <Header />
      <main>
        <h1>Solo</h1>
        <p className="subtitle">Pick your settings and start the round.</p>
        <RoundSetup
          ctaLabel="Start"
          onStart={(d, m) => router.push(`/play?d=${d}&m=${m}`)}
        />
      </main>
    </>
  );
}

'use client';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import RoundSetup from '@/components/RoundSetup';
import { generateRoomCode } from '@/lib/roomCode';

export default function RoomNewPage() {
  const router = useRouter();

  function handleCreate(duration: number, minLength: number) {
    const code = generateRoomCode();
    if (typeof window !== 'undefined') {
      // Carry host intent + chosen settings into the lobby. In Stage 2 this
      // will be sent to the PartyKit server when the room is created.
      sessionStorage.setItem(
        `room:${code}`,
        JSON.stringify({ host: true, duration, minLength, createdAt: Date.now() }),
      );
    }
    router.push(`/room/${code}`);
  }

  return (
    <>
      <Header />
      <main>
        <h1>Start a room</h1>
        <p className="subtitle">Pick the round settings — everyone in the room plays with them.</p>
        <RoundSetup ctaLabel="Create room" onStart={handleCreate} />
      </main>
    </>
  );
}

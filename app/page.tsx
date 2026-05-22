'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DURATIONS = [60, 90, 180];
const MIN_LENGTHS = [3, 4];

export default function Home() {
  const router = useRouter();
  const [duration, setDuration] = useState(90);
  const [minLength, setMinLength] = useState(3);

  return (
    <main>
      <h1>Arabic Boggle</h1>
      <p className="subtitle">Find as many words as you can before the timer runs out</p>

      <div className="setup-card">
        <div className="setup-row">
          <label>Duration (seconds)</label>
          <div className="choice-group">
            {DURATIONS.map(d => (
              <button
                key={d}
                className={`choice ${duration === d ? 'active' : ''}`}
                onClick={() => setDuration(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="setup-row">
          <label>Minimum word length</label>
          <div className="choice-group">
            {MIN_LENGTHS.map(m => (
              <button
                key={m}
                className={`choice ${minLength === m ? 'active' : ''}`}
                onClick={() => setMinLength(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <button
          className="primary-btn"
          onClick={() => router.push(`/play?d=${duration}&m=${minLength}`)}
        >
          Start
        </button>
      </div>
    </main>
  );
}

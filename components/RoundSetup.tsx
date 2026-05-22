'use client';
import { useState } from 'react';

const DURATIONS = [60, 90, 180];
const MIN_LENGTHS = [3, 4];

interface Props {
  ctaLabel?: string;
  defaultDuration?: number;
  defaultMinLength?: number;
  onStart: (duration: number, minLength: number) => void;
}

export default function RoundSetup({
  ctaLabel = 'Start',
  defaultDuration = 90,
  defaultMinLength = 3,
  onStart,
}: Props) {
  const [duration, setDuration] = useState(defaultDuration);
  const [minLength, setMinLength] = useState(defaultMinLength);

  return (
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

      <button className="primary-btn" onClick={() => onStart(duration, minLength)}>
        {ctaLabel}
      </button>
    </div>
  );
}

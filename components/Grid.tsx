'use client';
import { useCallback, useEffect, useRef } from 'react';
import { isAdjacent } from '@/lib/path';

interface Props {
  grid: string[];
  path: number[];
  onPathChange: (path: number[]) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

const SIZE = 4;

export default function Grid({ grid, path, onPathChange, onSubmit, disabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pathRef = useRef(path);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  const cellAt = useCallback((x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const cell = el.closest('[data-cell-idx]') as HTMLElement | null;
    if (!cell) return null;
    const idx = Number(cell.dataset.cellIdx);
    if (Number.isNaN(idx)) return null;
    return idx;
  }, []);

  const tryAppend = useCallback((idx: number) => {
    const cur = pathRef.current;
    if (cur.length === 0) {
      onPathChange([idx]);
      return;
    }
    const last = cur[cur.length - 1];
    if (last === idx) return;
    // Drag back to previous cell = undo last cell on path
    if (cur.length >= 2 && cur[cur.length - 2] === idx) {
      onPathChange(cur.slice(0, -1));
      return;
    }
    if (cur.includes(idx)) return;
    if (!isAdjacent(last, idx, SIZE)) return;
    onPathChange([...cur, idx]);
  }, [onPathChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const idx = cellAt(e.clientX, e.clientY);
    if (idx === null) return;
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    onPathChange([idx]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || disabled) return;
    const idx = cellAt(e.clientX, e.clientY);
    if (idx === null) return;
    tryAppend(idx);
  };

  const handlePointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (pathRef.current.length > 0) onSubmit();
  };

  return (
    <div
      ref={containerRef}
      className="grid"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {grid.map((letter, i) => {
        const pathIdx = path.indexOf(i);
        const isHead = pathIdx === path.length - 1 && pathIdx >= 0;
        const onPath = pathIdx >= 0;
        return (
          <div
            key={i}
            data-cell-idx={i}
            className={`cell ${onPath ? 'on-path' : ''} ${isHead ? 'head' : ''}`}
          >
            {letter}
          </div>
        );
      })}
    </div>
  );
}

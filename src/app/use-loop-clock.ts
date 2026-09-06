import { useCallback, useEffect, useRef, useState } from 'react';

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useLoopClock(duration: number) {
  const [time, setTimeState] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const timeRef = useRef(0);
  const durationRef = useRef(duration);
  const lastFrameRef = useRef<number | null>(null);

  durationRef.current = duration;

  const setTime = useCallback((next: number) => {
    const bounded = Math.max(0, Math.min(durationRef.current, next));
    timeRef.current = bounded === durationRef.current ? 0 : bounded;
    setTimeState(timeRef.current);
  }, []);

  useEffect(() => {
    if (timeRef.current > duration) setTime(0);
  }, [duration, setTime]);

  useEffect(() => {
    if (!playing) {
      lastFrameRef.current = null;
      return;
    }

    let frame = 0;
    const tick = (now: number) => {
      const last = lastFrameRef.current ?? now;
      lastFrameRef.current = now;
      const next = (timeRef.current + (now - last) / 1000) % durationRef.current;
      timeRef.current = next;
      setTimeState(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      lastFrameRef.current = null;
    };
  }, [playing]);

  return {
    phase: duration > 0 ? time / duration : 0,
    playing,
    restart: () => setTime(0),
    setPlaying,
    setTime,
    time,
    toggle: () => setPlaying((current) => !current),
  };
}

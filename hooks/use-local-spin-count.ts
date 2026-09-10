import { useEffect, useState } from 'react';
import { readBrowserCookie, writeBrowserCookie } from '@/lib/browser-cookie';

function savedCount() {
  const value = readBrowserCookie<number>('spins');
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

export function useLocalSpinCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => setCount(savedCount()), []);

  const recordSpin = () => {
    setCount(current => {
      const next = (current ?? savedCount()) + 1;
      try { writeBrowserCookie('spins', next); } catch { /* Counting must never block a spin. */ }
      return next;
    });
  };

  return { count, recordSpin };
}

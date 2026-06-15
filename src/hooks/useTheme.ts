import { useState, useEffect, useCallback } from 'react';
import { getTheme, setTheme } from '../utils/storage';

export function useTheme() {
  const [dark, setDarkState] = useState(false);

  useEffect(() => {
    getTheme().then((t) => {
      setDarkState(t === 'dark');
      document.documentElement.classList.toggle('dark', t === 'dark');
    });
  }, []);

  const toggleDark = useCallback(() => {
    setDarkState((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      setTheme(next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return { dark, toggleDark };
}

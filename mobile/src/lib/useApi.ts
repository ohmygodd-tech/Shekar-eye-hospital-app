import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from './api';

/** Fetch data for a screen; refetches when the screen regains focus. */
export function useApi<T>(path: string | null, opts: { refetchOnFocus?: boolean } = { refetchOnFocus: true }) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [refreshing, setRefreshing] = useState(false);
  const first = useRef(true);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    if (!path) return;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [path]);

  useEffect(() => { load('initial'); }, [load]);

  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    if (opts.refetchOnFocus !== false) load('silent');
  }, [load, opts.refetchOnFocus]));

  return { data, error, loading, refreshing, refresh: () => load('refresh'), reload: () => load('silent'), setData };
}

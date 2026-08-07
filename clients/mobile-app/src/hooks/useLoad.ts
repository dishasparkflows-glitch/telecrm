import { useCallback, useEffect, useRef, useState } from 'react';
export function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[] = []) {
  const loaderRef = useRef(loader); loaderRef.current = loader;
  const [data, setData] = useState<T>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => { setLoading(true); setError(''); try { setData(await loaderRef.current()); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setLoading(false); } }, deps);
  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

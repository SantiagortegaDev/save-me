import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribe } from '../db/repo';

// Runs an async DB query and re-runs it whenever the library changes.
export function useQuery<T>(query: () => Promise<T>, deps: unknown[]): { data: T | undefined; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const queryRef = useRef(query);
  const token = useRef(0);

  // Declared before the effect below so it runs first and reload() sees the latest query.
  useEffect(() => {
    queryRef.current = query;
  });

  const reload = useCallback(() => {
    const current = ++token.current;
    queryRef
      .current()
      .then((result) => {
        if (current === token.current) setData(result);
      })
      .catch((error) => console.warn('[useQuery]', error))
      .finally(() => {
        if (current === token.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    reload();
    return subscribe(reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, reload };
}

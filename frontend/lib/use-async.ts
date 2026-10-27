"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "./errors";

interface Result<T> {
  id: string;
  data: T | null;
  error: string | null;
}

/**
 * Loads data and re-loads when `key` changes or `reload()` is called.
 * `key` must describe everything `load` depends on (e.g. JSON.stringify of the filters).
 * While a reload is in flight the previous data stays available, so lists don't flash empty.
 */
export function useAsync<T>(load: () => Promise<T>, key: string) {
  const loadRef = useRef(load);
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const id = `${key}:${tick}`;

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    loadRef
      .current()
      .then((data) => !cancelled && setResult({ id, data, error: null }))
      .catch((e) => !cancelled && setResult({ id, data: null, error: errorText(e) }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  /** Replace the data directly, e.g. with the response of an update call. */
  const setData = useCallback((data: T) => setResult({ id, data, error: null }), [id]);

  return {
    data: result?.data ?? null,
    error: result && result.id === id ? result.error : null,
    loading: result?.id !== id,
    reload,
    setData,
  };
}

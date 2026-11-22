import { useEffect, useState } from 'react'

/** Re-renders the caller every `ms` so relative timestamps stay fresh without per-second churn. */
export function useNow(ms = 10_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

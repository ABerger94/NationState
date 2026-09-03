import { useEffect, useRef, useState } from 'react'

/** Smoothly animates a number toward its latest value. */
export function useTween(value: number, ms = 500): number {
  const [v, setV] = useState(value)
  const current = useRef(value)
  useEffect(() => {
    const from = current.current
    const to = value
    if (from === to) return
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - t, 3)
      current.current = from + (to - from) * e
      setV(current.current)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return v
}

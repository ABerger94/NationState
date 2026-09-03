import { useEffect, useState } from 'react'

const QUERY = '(max-width: 900px)'

/** True on phones and small tablets; updates on rotation and resize. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false))
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

export function isMobileNow(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches
}

'use client'

import { useSyncExternalStore } from 'react'

const mobileQuery = '(max-width: 600px)'

function subscribe(callback) {
  const media = window.matchMedia(mobileQuery)
  media.addEventListener('change',callback)
  return () => media.removeEventListener('change',callback)
}

const mobileSnapshot = () => window.matchMedia(mobileQuery).matches
const serverSnapshot = () => false

export function useMobileScreen() {
  return useSyncExternalStore(subscribe,mobileSnapshot,serverSnapshot)
}

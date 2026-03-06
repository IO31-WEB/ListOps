import { useState, useCallback } from 'react'

export function useCopyToClipboard(resetDelay: number = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), resetDelay)
      return true
    } catch {
      return false
    }
  }, [resetDelay])

  return { copiedKey, copy }
}

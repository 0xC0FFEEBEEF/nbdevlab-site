import { useEffect } from 'react'

export function NotFoundPage() {
  useEffect(() => {
    const previous = document.title
    document.title = 'NBDEVLAB — Page Not Found'
    return () => { document.title = previous }
  }, [])

  return (
    <iframe
      title="Page not found — NBDEVLAB"
      src="/404.html"
      allow="autoplay"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100dvh', border: 0, background: '#020407' }}
    />
  )
}

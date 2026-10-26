'use client'

export function PrintButton({ color }: { color: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="no-print"
      style={{ background: color, color: 'white', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}>
      Print / Save as PDF
    </button>
  )
}

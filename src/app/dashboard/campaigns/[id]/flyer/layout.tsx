// Flyer page gets its own layout — bypasses the dashboard sidebar/header
// so they don't appear in print and the page fits letter size correctly
export default function FlyerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

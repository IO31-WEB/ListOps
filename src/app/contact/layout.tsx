import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Contact ListOps',
  description: 'Contact the ListOps team for support, billing questions, brokerage and enterprise inquiries.',
  path: '/contact',
})

export default function ContactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}

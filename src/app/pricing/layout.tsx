import type { ReactNode } from 'react'
import { JsonLd } from '@/components/seo/json-ld'
import { pageMetadata, softwareLd, breadcrumbLd } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Pricing: Free, Starter, Pro, Commercial and Brokerage Plans',
  description: 'ListOps pricing for real estate agents, commercial brokers and brokerages. Start free; paid plans add team seats (Pro and Commercial 2, Brokerage 25), commercial campaigns and brokerage tools.',
  path: '/pricing',
})

export default function PricingLayout({ children }: { children: ReactNode }) {
  return (<><JsonLd data={[softwareLd(), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }])]} />{children}</>)
}

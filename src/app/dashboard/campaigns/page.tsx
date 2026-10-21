'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, FileText, ArrowRight, Filter, Download, RefreshCw, Eye, Copy, Check } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Campaign {
  id: string
  status: string
  createdAt: string
  generationMs?: number
  micrositeSlug?: string
  micrositePublished?: boolean
  micrositeViews?: number
  listing?: {
    address?: string
    city?: string
    state?: string
    price?: string
    bedrooms?: number
    bathrooms?: string
    sqft?: number
  }
  facebookPosts?: unknown[]
  instagramPosts?: unknown[]
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'complete' | 'generating' | 'failed'>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch (err) {
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  const filteredCampaigns = campaigns.filter(c => {
    const address = `${c.listing?.address ?? ''} ${c.listing?.city ?? ''} ${c.listing?.state ?? ''}`.toLowerCase()
    const matchesSearch = !search || address.includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || c.status === filter
    return matchesSearch && matchesFilter
  })

  const copyMicrositeUrl = async (slug: string, id: string) => {
    const url = `${window.location.origin}/l/${slug}`
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast.success('Microsite URL copied!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-100 text-green-700'
      case 'generating': return 'bg-amber-100 text-amber-700 animate-pulse'
      case 'failed': return 'bg-red-100 text-red-700'
      default: return 'bg-slate-100 text-slate-600'
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">My Campaigns</h1>
          <p className="text-sm text-slate-500 mt-1">{campaigns.length} total campaigns</p>
        </div>
        <Link
          href="/dashboard/generate"
          className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by address..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {(['all', 'complete', 'generating', 'failed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors capitalize ${
                filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={fetchCampaigns} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Campaign List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-500">Loading campaigns...</p>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-slate-400" />
            </div>
            <h4 className="font-display text-lg font-semibold text-slate-900 mb-2">
              {search
                ? 'No matching campaigns'
                : filter === 'generating' ? 'No campaigns generating'
                : filter === 'failed' ? 'No failed campaigns'
                : filter === 'complete' ? 'No completed campaigns yet'
                : 'No campaigns yet'}
            </h4>
            <p className="text-slate-500 text-sm mb-6">
              {search
                ? 'Try a different search term.'
                : filter === 'generating' ? 'Campaigns in progress will appear here.'
                : filter === 'failed' ? 'Any generation errors will show up here.'
                : filter === 'complete' ? 'Your completed campaigns will appear here.'
                : 'Generate your first campaign from your listing details and photos.'}
            </p>
            <Link href="/dashboard/generate" className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors">
              <Plus className="w-4 h-4" /> {filter === 'all' && !search ? 'Create First Campaign' : 'New Campaign'}
            </Link>
          </div>
        ) : (
          <>
            {/* Table header - desktop */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_100px_120px_80px] gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>Listing</span>
              <span>Status</span>
              <span>Generated</span>
              <span>Microsite</span>
              <span></span>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredCampaigns.map((campaign) => {
                const address = [campaign.listing?.address, campaign.listing?.city, campaign.listing?.state]
                  .filter(Boolean).join(', ')
                const price = campaign.listing?.price
                  ? `$${Number(campaign.listing.price).toLocaleString()}`
                  : null
                const details = [
                  campaign.listing?.bedrooms ? `${campaign.listing.bedrooms}bd` : null,
                  campaign.listing?.bathrooms ? `${campaign.listing.bathrooms}ba` : null,
                  campaign.listing?.sqft ? `${campaign.listing.sqft.toLocaleString()} sqft` : null,
                ].filter(Boolean).join(' · ')

                return (
                  <div key={campaign.id} className="flex flex-col sm:grid sm:grid-cols-[1fr_120px_100px_120px_80px] sm:items-center gap-3 sm:gap-4 p-4 sm:px-6 hover:bg-slate-50 transition-colors group">
                    {/* Listing info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-amber-700" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{address || 'Campaign'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {[price, details].filter(Boolean).join(' · ') || 'No listing details'}
                        </p>
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full capitalize ${getStatusBadge(campaign.status)}`}>
                        {campaign.status === 'generating' && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />}
                        {campaign.status}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="text-xs text-slate-500">{formatDate(campaign.createdAt)}</div>

                    {/* Microsite */}
                    <div>
                      {campaign.micrositeSlug && campaign.micrositePublished ? (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`/l/${campaign.micrositeSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            {campaign.micrositeViews ?? 0} views
                          </a>
                          <button
                            onClick={() => copyMicrositeUrl(campaign.micrositeSlug!, campaign.id)}
                            className="p-1 rounded hover:bg-slate-100 transition-colors"
                          >
                            {copiedId === campaign.id
                              ? <Check className="w-3 h-3 text-green-600" />
                              : <Copy className="w-3 h-3 text-slate-400" />
                            }
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>

                    {/* Action */}
                    <div className="flex justify-end">
                      <Link
                        prefetch={false}
                        href={`/dashboard/campaigns/${campaign.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all"
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

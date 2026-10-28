/**
 * One Clerk theme for the whole app, so Clerk's own UI (sign-in, the avatar menu, the account page) is styled
 * with ListOps's palette, fonts and radii instead of Clerk's defaults.
 */
import type { ComponentProps } from 'react'
import type { ClerkProvider } from '@clerk/nextjs'

// Derived from ClerkProvider's own props, so we don't depend on @clerk/types being importable directly.
type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>['appearance']>

export const clerkVariables: NonNullable<Appearance['variables']> = {
  colorPrimary: '#0f172a',
  colorText: '#0f172a',
  colorTextSecondary: '#64748b',
  colorBackground: '#ffffff',
  colorInputBackground: '#f8fafc',
  colorInputText: '#0f172a',
  colorDanger: '#dc2626',
  colorSuccess: '#15803d',
  fontFamily: 'var(--font-body), DM Sans, system-ui, sans-serif',
  fontFamilyButtons: 'var(--font-body), DM Sans, system-ui, sans-serif',
  borderRadius: '0.75rem',
}

export const clerkElements: NonNullable<Appearance['elements']> = {
  formButtonPrimary: 'bg-slate-900 hover:bg-slate-800 text-amber-50 font-medium shadow-none normal-case',
  card: 'shadow-xl border border-amber-100',
  headerTitle: 'font-display text-slate-900',
  formFieldInput: 'border-slate-200 focus:ring-2 focus:ring-amber-400 focus:border-transparent',
  footerActionLink: 'text-amber-700 hover:text-amber-800',
  // Avatar menu (the account button in the sidebar)
  userButtonPopoverCard: 'rounded-2xl border border-slate-200 shadow-xl',
  userButtonPopoverActionButton: 'hover:bg-slate-50',
}

/** For the embedded account page: sits inside the dashboard like any other card — no floating modal chrome. */
export const clerkEmbeddedProfile: Appearance = {
  variables: clerkVariables,
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full max-w-none shadow-none border border-slate-200 rounded-2xl overflow-hidden bg-white',
    card: 'shadow-none border-0',
    scrollBox: 'rounded-none',
    navbar: 'bg-slate-50 border-r border-slate-100',
    navbarButton: 'text-slate-600 hover:bg-white data-[active=true]:bg-white data-[active=true]:text-slate-900',
    pageScrollBox: 'p-4 sm:p-8',
    profileSectionTitleText: 'font-display text-slate-900',
    formButtonPrimary: 'bg-slate-900 hover:bg-slate-800 text-amber-50 font-medium shadow-none normal-case',
    badge: 'bg-amber-100 text-amber-800',
  },
}

export const clerkAppearance: Appearance = { variables: { ...clerkVariables, colorBackground: '#fef9f0' }, elements: clerkElements }

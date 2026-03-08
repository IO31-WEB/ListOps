/**
 * Feature Flags
 * Lightweight flag system for soft-launching features to specific users/orgs.
 * No external dependency — flags stored in DB (organizations.featureFlags)
 * or overridden via environment variables for global rollouts.
 *
 * Usage:
 *   const flags = await getFeatureFlags(userId)
 *   if (flags.brokerageEarlyAccess) { ... }
 */

export interface FeatureFlags {
  // Plan soft-launch flags
  brokerageEarlyAccess: boolean    // Allow non-brokerage users to try brokerage features
  proEarlyAccess: boolean          // Allow starter users to try pro features

  // UI flags
  newDashboardLayout: boolean      // A/B test new dashboard
  pdfDownloadEnabled: boolean      // PDF generation via R2
  micrositeEnabled: boolean        // Auto-generated listing microsite
  referralProgramEnabled: boolean  // Referral program UI
  teamSeatsEnabled: boolean        // Team management UI
  analyticsEnabled: boolean        // Usage analytics dashboard

  // Experimental
  streamingGeneration: boolean     // Stream AI output token by token
  aiImageGeneration: boolean       // Generate property images with AI
}

const DEFAULT_FLAGS: FeatureFlags = {
  brokerageEarlyAccess: false,
  proEarlyAccess: false,
  newDashboardLayout: false,
  pdfDownloadEnabled: true,         // On by default — controlled by plan
  micrositeEnabled: true,           // On by default — controlled by plan
  referralProgramEnabled: true,
  teamSeatsEnabled: true,
  analyticsEnabled: false,          // Not built yet
  streamingGeneration: false,
  aiImageGeneration: false,
}

// ── Global env overrides (set in Vercel to instantly toggle for all users) ──
function getEnvFlags(): Partial<FeatureFlags> {
  const overrides: Partial<FeatureFlags> = {}

  if (process.env.FLAG_BROKERAGE_EARLY_ACCESS === 'true') overrides.brokerageEarlyAccess = true
  if (process.env.FLAG_PRO_EARLY_ACCESS === 'true') overrides.proEarlyAccess = true
  if (process.env.FLAG_NEW_DASHBOARD === 'true') overrides.newDashboardLayout = true
  if (process.env.FLAG_STREAMING === 'true') overrides.streamingGeneration = true
  if (process.env.FLAG_PDF_DISABLED === 'true') overrides.pdfDownloadEnabled = false

  return overrides
}

// ── Per-org flags stored in DB (jsonb column) ─────────────────
// Add featureFlags jsonb to organizations table via migration:
//   ALTER TABLE organizations ADD COLUMN feature_flags jsonb DEFAULT '{}';
export async function getFeatureFlags(
  orgFlags?: Record<string, boolean> | null
): Promise<FeatureFlags> {
  const envOverrides = getEnvFlags()
  const orgOverrides = orgFlags ?? {}

  return {
    ...DEFAULT_FLAGS,
    ...envOverrides,
    ...orgOverrides,
  }
}

/**
 * Check a single flag — convenience wrapper.
 */
export function flagEnabled(
  flags: FeatureFlags,
  flag: keyof FeatureFlags
): boolean {
  return flags[flag] === true
}

/**
 * Get flags for a specific user's plan tier.
 * Automatically enables features based on plan.
 */
export function getFlagsForPlan(
  planTier: string,
  orgFlags?: Record<string, boolean> | null
): FeatureFlags {
  const base = { ...DEFAULT_FLAGS, ...getEnvFlags(), ...(orgFlags ?? {}) }

  // Pro+ gets streaming when available
  if (['pro', 'brokerage', 'enterprise'].includes(planTier)) {
    // base.streamingGeneration = true  // uncomment when built
  }

  // Brokerage+ gets analytics
  if (['brokerage', 'enterprise'].includes(planTier)) {
    base.analyticsEnabled = true
  }

  return base
}

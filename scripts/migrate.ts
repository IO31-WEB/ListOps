import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS "organizations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "slug" text NOT NULL,
      "plan" text NOT NULL DEFAULT 'free',
      "white_label" boolean NOT NULL DEFAULT false,
      "custom_domain" text,
      "custom_app_name" text,
      "custom_logo_url" text,
      "custom_favicon_url" text,
      "custom_primary_color" text,
      "custom_accent_color" text,
      "custom_support_email" text,
      "hide_powered_by" boolean NOT NULL DEFAULT false,
      "mls_boards" text[],
      "stripe_customer_id" text,
      "max_agents" integer NOT NULL DEFAULT 1,
      "campaigns_per_agent_per_month" integer NOT NULL DEFAULT 3,
      "saml_enabled" boolean NOT NULL DEFAULT false,
      "saml_config" jsonb,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "clerk_id" text NOT NULL,
      "org_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
      "role" text NOT NULL DEFAULT 'agent',
      "email" text NOT NULL,
      "first_name" text,
      "last_name" text,
      "phone" text,
      "license_number" text,
      "mls_agent_id" text,
      "avatar_url" text,
      "timezone" text NOT NULL DEFAULT 'America/New_York',
      "ai_persona" jsonb,
      "campaigns_used_this_month" integer NOT NULL DEFAULT 0,
      "campaigns_used_total" integer NOT NULL DEFAULT 0,
      "last_reset_at" timestamp NOT NULL DEFAULT now(),
      "referral_code" text,
      "referred_by" uuid,
      "onboarding_complete" boolean NOT NULL DEFAULT false,
      "onboarding_step" integer NOT NULL DEFAULT 0,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "subscriptions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "user_id" uuid REFERENCES "users"("id"),
      "stripe_subscription_id" text,
      "stripe_price_id" text,
      "stripe_current_period_end" timestamp,
      "plan" text NOT NULL DEFAULT 'free',
      "status" text NOT NULL DEFAULT 'trialing',
      "billing_interval" text NOT NULL DEFAULT 'month',
      "trial_ends_at" timestamp,
      "trial_campaigns_used" integer NOT NULL DEFAULT 0,
      "cancel_at_period_end" boolean NOT NULL DEFAULT false,
      "canceled_at" timestamp,
      "cancellation_reason" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "brand_kits" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "org_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
      "logo_url" text,
      "agent_photo_url" text,
      "primary_color" text NOT NULL DEFAULT '#1e293b',
      "accent_color" text NOT NULL DEFAULT '#f59e0b',
      "font_family" text NOT NULL DEFAULT 'Georgia',
      "agent_name" text,
      "agent_title" text NOT NULL DEFAULT 'REALTOR®',
      "agent_phone" text,
      "agent_email" text,
      "agent_website" text,
      "brokerage_name" text,
      "brokerage_logo" text,
      "tagline" text,
      "disclaimer" text,
      "facebook_url" text,
      "instagram_handle" text,
      "linkedin_url" text,
      "is_default" boolean NOT NULL DEFAULT true,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "listings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "mls_id" text,
      "mls_board" text,
      "source" text NOT NULL DEFAULT 'manual',
      "enrichment_provider" text,
      "enrichment_data" jsonb,
      "agent_id" uuid NOT NULL REFERENCES "users"("id"),
      "org_id" uuid REFERENCES "organizations"("id"),
      "address" text,
      "city" text,
      "state" text,
      "zip" text,
      "price" numeric,
      "bedrooms" integer,
      "bathrooms" numeric,
      "sqft" integer,
      "year_built" integer,
      "property_type" text,
      "description" text,
      "features" text[],
      "photos" text[],
      "photo_keys" text[] DEFAULT '{}',
      "listing_agent_name" text,
      "listing_agent_email" text,
      "listing_agent_phone" text,
      "office_name" text,
      "raw_data" jsonb,
      "status" text NOT NULL DEFAULT 'active',
      "fetched_at" timestamp NOT NULL DEFAULT now(),
      "expires_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "campaigns" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "listing_id" uuid REFERENCES "listings"("id"),
      "agent_id" uuid NOT NULL REFERENCES "users"("id"),
      "org_id" uuid REFERENCES "organizations"("id"),
      "brand_kit_id" uuid REFERENCES "brand_kits"("id"),
      "status" text NOT NULL DEFAULT 'generating',
      "generation_ms" integer,
      "facebook_posts" jsonb,
      "instagram_posts" jsonb,
      "email_just_listed" text,
      "email_still_available" text,
      "flyer_url" text,
      "video_script" text,
      "microsite_slug" text,
      "microsite_published" boolean NOT NULL DEFAULT false,
      "microsite_views" integer NOT NULL DEFAULT 0,
      "published_channels" text[],
      "scheduled_publish_at" timestamp,
      "analytics" jsonb DEFAULT '{}',
      "prompt_tokens" integer,
      "completion_tokens" integer,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid REFERENCES "organizations"("id"),
      "user_id" uuid REFERENCES "users"("id"),
      "action" text NOT NULL,
      "resource_type" text,
      "resource_id" uuid,
      "metadata" jsonb,
      "ip_address" inet,
      "user_agent" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "referrals" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "referrer_id" uuid NOT NULL REFERENCES "users"("id"),
      "referred_user_id" uuid REFERENCES "users"("id"),
      "referred_email" text NOT NULL,
      "status" text NOT NULL DEFAULT 'pending',
      "reward_granted" boolean NOT NULL DEFAULT false,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `
  console.log('Migration complete!')
}

migrate().catch(console.error)

import { createServerComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/** Use inside Server Components (page.tsx files with async function). */
export const createServerClient = () =>
  createServerComponentClient({ cookies })

/**
 * Use inside API Route Handlers (route.ts files). createServerComponentClient
 * doesn't reliably read the session cookie inside a Route Handler's request
 * context — this is the client built for that instead.
 */
export const createRouteClient = () =>
  createRouteHandlerClient({ cookies })

/**
 * Service-role client — bypasses Row Level Security entirely.
 * ONLY use this in trusted server code (webhooks, admin-gated API routes)
 * that has already verified the caller is authorized. Never expose this
 * client or the service role key to the browser.
 */
export const createAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

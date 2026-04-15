import { createClient } from '@supabase/supabase-js'
// GUARD: The service-role key bypasses RLS and must NEVER be exposed to any client-side code.
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided in .env')
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey)

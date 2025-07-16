import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

console.log('[DEBUG] SUPABASE_URL:', process.env.SUPABASE_URL?.slice(0, 10) + '...')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default supabase

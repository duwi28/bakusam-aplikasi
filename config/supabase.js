const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client untuk operasi umum
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Supabase client untuk operasi admin (menggunakan service role key)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = { supabase, supabaseAdmin }; 
const SUPABASE_URL = 'https://gtspvslwoauifgurfkpx.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_kLlEvARJ8yWYNxU9fjN1uA_7faot8ie';

// Inisialisasi Klien Global
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
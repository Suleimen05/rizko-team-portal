// ===== RIZKO TEAM PORTAL CONFIGURATION =====

var CONFIG = {
  supabase: {
    url: 'https://romawqyfqlnmgwakgnkn.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvbWF3cXlmcWxubWd3YWtnbmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTc2MDMsImV4cCI6MjA5MDAzMzYwM30.qFTG3QEKGhDUOjg944myt3rh1gXP75KZqAp8fF_9z68',
  },
  currencies: {
    USD: { symbol: '$', name: 'Доллар' },
    KZT: { symbol: '₸', name: 'Тенге' },
  },
  defaultCurrency: 'USD',
};

// Auto-detect: if running locally use localhost, otherwise use Railway backend
var SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://rizko-team-portal-production.up.railway.app';

// Supabase client — CDN creates `var supabase` as library with createClient
// We replace it with the initialized client instance
var supabase = supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  }
});

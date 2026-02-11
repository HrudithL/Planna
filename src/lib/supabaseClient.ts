import { createClient } from '@supabase/supabase-js';

// Get Supabase connection details from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set');
}

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Helper to check if Supabase is properly configured
export const isSupabaseAvailable = () => Boolean(supabaseUrl && supabaseAnonKey);


import { supabase, isSupabaseAvailable } from '../../supabaseClient';
import type { User } from '@/types';

export async function getUserByEmail(email: string): Promise<User | null> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  // Normalize email to lowercase for case-insensitive matching
  const emailLower = email.toLowerCase().trim();
  
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, password_hash, is_admin')
    .ilike('email', emailLower)
    .single();
  
  if (error || !data) return null;
  
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    is_admin: data.is_admin ?? false,
  };
}

export async function getUserById(id: string): Promise<User | null> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, is_admin')
    .eq('id', id)
    .single();
  
  if (error || !data) return null;
  
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    is_admin: data.is_admin ?? false,
  };
}

export async function createUser(email: string, name: string, passwordHash: string): Promise<User> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { data, error } = await supabase
    .from('users')
    .insert({ email, name, password_hash: passwordHash })
    .select('id, email, name, is_admin')
    .single();
  
  if (error || !data) {
    throw new Error(error?.message || 'Failed to create user');
  }
  
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    is_admin: data.is_admin ?? false,
  };
}




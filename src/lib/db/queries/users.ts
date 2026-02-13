/**
 * User queries - DEPRECATED
 * 
 * The custom `users` table has been dropped in the schema redesign.
 * Authentication should be handled through Supabase Auth (auth.users).
 * 
 * These functions are stubs that throw errors to prevent accidental use.
 * The app falls back to mock data for auth when the DB layer is active.
 */
import type { User } from '@/types';

export async function getUserByEmail(_email: string): Promise<User | null> {
  throw new Error('Custom users table no longer exists. Use Supabase Auth instead.');
}

export async function getUserById(_id: string): Promise<User | null> {
  throw new Error('Custom users table no longer exists. Use Supabase Auth instead.');
}

export async function createUser(_email: string, _name: string, _passwordHash: string): Promise<User> {
  throw new Error('Custom users table no longer exists. Use Supabase Auth instead.');
}

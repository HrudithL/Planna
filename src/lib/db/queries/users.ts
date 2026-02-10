import { sql } from '../index';
import type { User } from '@/types';

export async function getUserByEmail(email: string): Promise<User | null> {
  if (!sql) throw new Error('Database not available');
  
  const result = await sql`
    SELECT id, email, name, password_hash, is_admin
    FROM users
    WHERE email = ${email}
  `;
  
  if (result.length === 0) return null;
  
  const row = result[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    is_admin: row.is_admin ?? false,
  };
}

export async function getUserById(id: string): Promise<User | null> {
  if (!sql) throw new Error('Database not available');
  
  const result = await sql`
    SELECT id, email, name, is_admin
    FROM users
    WHERE id = ${id}
  `;
  
  if (result.length === 0) return null;
  
  const row = result[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    is_admin: row.is_admin ?? false,
  };
}

export async function createUser(email: string, name: string, passwordHash: string): Promise<User> {
  if (!sql) throw new Error('Database not available');
  
  const result = await sql`
    INSERT INTO users (email, name, password_hash)
    VALUES (${email}, ${name}, ${passwordHash})
    RETURNING id, email, name, is_admin
  `;
  
  const row = result[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    is_admin: row.is_admin ?? false,
  };
}




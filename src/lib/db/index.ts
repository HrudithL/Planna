import { neon } from '@neondatabase/serverless';

// Get database URL from environment variable
// For development, use: postgresql://neondb_owner:npg_5MFNTgACXqn2@ep-curly-sun-aj86pr2i-pooler.c-3.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
const DATABASE_URL = import.meta.env.VITE_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('DATABASE_URL not set, using mock data');
}

// Create Neon serverless SQL client
export const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

// Helper to check if database is available
export const isDatabaseAvailable = () => sql !== null;




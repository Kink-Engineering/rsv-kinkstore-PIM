#!/usr/bin/env node
/**
 * Run SQL migrations against Supabase using direct postgres connection
 * Usage: node scripts/run-sql.mjs <path-to-sql-file>
 * 
 * Requires DATABASE_URL in .env.local like:
 * DATABASE_URL=postgresql://postgres.gljvnwkozhzqnjlafada:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
 */

import dns from 'dns'
// Force IPv4 to avoid WSL2 IPv6 issues
dns.setDefaultResultOrder('ipv4first')

import pg from 'pg'
import { readFileSync } from 'fs'
import { config } from 'dotenv'

const { Client } = pg

// Load .env.local
config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('Missing DATABASE_URL in .env.local')
  console.log('')
  console.log('Add your database connection string to .env.local:')
  console.log('DATABASE_URL=postgresql://postgres.gljvnwkozhzqnjlafada:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres')
  console.log('')
  console.log('Find this in Supabase Dashboard → Project Settings → Database → Connection string (URI)')
  process.exit(1)
}

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Usage: node scripts/run-sql.mjs <path-to-sql-file>')
  process.exit(1)
}

const sql = readFileSync(sqlFile, 'utf-8')

console.log(`Running SQL from: ${sqlFile}`)
console.log('---')

const client = new Client({ 
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
})

try {
  await client.connect()
  const result = await client.query(sql)
  console.log('✓ SQL executed successfully!')
  if (result.rows?.length > 0) {
    console.log('Result:', result.rows)
  }
} catch (error) {
  console.error('✗ Error executing SQL:', error.message)
  process.exit(1)
} finally {
  await client.end()
}

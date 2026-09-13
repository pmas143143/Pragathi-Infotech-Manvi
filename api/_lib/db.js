const { neon } = require('@neondatabase/serverless');
function db(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured in Vercel Environment Variables.');
  return neon(process.env.DATABASE_URL);
}
async function ensureSchema(sql){
  await sql`CREATE TABLE IF NOT EXISTS admin_users (id SERIAL PRIMARY KEY, username VARCHAR(80) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), password_changed_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS admin_sessions (id BIGSERIAL PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE, token_hash CHAR(64) NOT NULL UNIQUE, csrf_token_hash CHAR(64) NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON admin_sessions(admin_id)`;
  await sql`CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions(expires_at)`;
  await sql`CREATE TABLE IF NOT EXISTS login_attempts (attempt_key CHAR(64) PRIMARY KEY, failed_count INTEGER NOT NULL DEFAULT 0, first_failed_at TIMESTAMPTZ DEFAULT NOW(), blocked_until TIMESTAMPTZ)`;
  await sql`CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name VARCHAR(160) NOT NULL, price VARCHAR(80) NOT NULL DEFAULT 'Contact Us', configuration VARCHAR(1000) NOT NULL DEFAULT '', image_data TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_data TEXT NOT NULL DEFAULT ''`;
  await sql`CREATE TABLE IF NOT EXISTS enquiries (id BIGSERIAL PRIMARY KEY, service VARCHAR(120) NOT NULL, name VARCHAR(120) NOT NULL, mobile VARCHAR(30) NOT NULL, message VARCHAR(2000) NOT NULL DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'new', ip_address VARCHAR(45), created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS settings (setting_key VARCHAR(80) PRIMARY KEY, setting_value VARCHAR(1000) NOT NULL DEFAULT '')`;
  await sql`CREATE TABLE IF NOT EXISTS activity_log (id BIGSERIAL PRIMARY KEY, admin_id INTEGER, action VARCHAR(120) NOT NULL, details VARCHAR(1000) NOT NULL DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`INSERT INTO settings(setting_key,setting_value) VALUES ('business_name','Pragathi Infotech'),('address','Sindhanur Road, Opp APMC, Manvi, Raichur - 584123'),('phones','7483311445 / 9741856999'),('working_hours','Mon - Sat: 9:00 AM - 7:00 PM') ON CONFLICT (setting_key) DO NOTHING`;
}
module.exports={db,ensureSchema};

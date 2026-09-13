# Pragathi Infotech - Vercel + Neon (Secure Admin V5)

## Vercel Environment Variables
- DATABASE_URL = your Neon production connection string
- JWT_SECRET = a long random secret (kept for environment compatibility; sessions are now server-side)
- ADMIN_USERNAME = admin (only used if your existing database already contains this admin account)

## Security improvements in V5
- Server-side opaque admin sessions stored in Neon; no JWT session data is exposed to the browser.
- Session tokens are random and only SHA-256 hashes are stored in the database.
- Sessions expire after 8 hours and old sessions are removed when a new login is created.
- Password change invalidates all active sessions.
- Login attempts are rate-limited and temporarily locked after repeated failures.
- No temporary/default password is embedded in the application.
- Passwords are never written to HTML, JavaScript, or the repository.
- Secure, HttpOnly, SameSite session cookie.
- Security headers including frame protection, MIME sniffing protection, referrer policy and CSP.
- Admin login has no pre-filled username/password and includes a password visibility control.

## Important
V5 does NOT guarantee removal of a Google Chrome Safe Browsing warning. That warning is controlled by Google's security reputation systems. If the warning remains on a Vercel preview URL, use your production domain and submit a Security Issues review through Google Search Console if necessary.

## Existing database
Your existing `admin_users` password hash is preserved. You should log in with the password that currently works, then use **Change Password** to set a strong new password.

Recommended password: at least 12 characters, including uppercase, lowercase, number and a special character.

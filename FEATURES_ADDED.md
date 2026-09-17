# LostLink USTH - Full-stack features

This version keeps the original HTML/CSS visual design while replacing browser-only demo data with a real backend.

## User features

- Register and login
- Real PostgreSQL posts
- LOST / FOUND listing
- Search and filters
- Post creation and image upload
- Edit, resolve and delete own posts
- Ownership claims for FOUND items
- Claim tracking with CLM code
- Admin-issued pickup code after approval
- Contact feedback with tracking code
- Security reports
- Campus map populated from backend data

## Admin features

- Real JWT Admin login
- Dashboard statistics
- Post moderation
- Claim review
- Feedback processing
- Security report processing

## Data storage

Application data is stored in PostgreSQL.

`localStorage` is no longer used as a fake database. It is limited to the JWT session and optional UI preferences.

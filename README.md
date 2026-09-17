# LostLink USTH

LostLink is a lost and found website for the USTH community. It uses static HTML/CSS/JavaScript, Express, PostgreSQL, and optional Supabase Storage for images.


## Project folders

- `frontend/` contains all browser-facing HTML, admin pages, CSS, images, fonts, and JavaScript.
- `backend/` contains the Express API, database access, routes, middleware, migrations, scripts, and tests.
- The backend intentionally imports the shared location/category catalog from `frontend/asset/js/catalog.js`, so keep that path when reorganizing the repository.
- `vercel.json` keeps the existing public routes such as `/index.html`, `/lost.html`, `/admin/login.html`, and `/asset/...` working while the source files live under `frontend/`.

## Current access model

- Visitors can browse active posts, create posts, submit ownership claims, send feedback, and file security reports without an account.
- A **management code is a secret**. Anyone holding it can view, edit, resolve, or delete its post, except that a post hidden by an admin cannot be changed with the code. The browser keeps the code in the current tab's `sessionStorage`; copy it to a safe place before closing the tab.
- Claim, feedback, and security tracking codes are also private. A claim's pickup code is shown only while the claim is approved.
- Only admins log in. Admin routes require a JWT with the admin role. There is no public registration or user login.
- Feedback on a post goes to admins. To contact the poster, use the phone/email shown on the post detail page.

## Set up a fresh database

Use PostgreSQL or Supabase PostgreSQL. Run `backend/database/schema.sql` in your SQL client or Supabase SQL Editor. This creates tables, indexes, and RLS. The Express server connects with a trusted `postgres` database role; the tables are not intended to be queried directly by browser anon/authenticated Data API roles.

For an **existing** database, back up data and run `backend/database/upgrade-2026-09-16.sql` before deploying this backend. The migration widens code columns, adds claim uniqueness constraints, normalizes older category/location labels, removes malformed question entries, enables RLS, and creates upload tracking. It aborts if old claims conflict with the new uniqueness rules. Review and resolve those claims before retrying. Do not rerun the fresh schema as a substitute for the upgrade.

No migration is run automatically by the app. Review it and execute it in your database environment.

## Run locally

1. Copy `backend/.env.example` to `backend/.env`. Set `DATABASE_URL`, `JWT_SECRET`, and `FRONTEND_URLS`. Keep `.env` private. Use `DATABASE_SSL=true` for Supabase's hosted database.
2. In `backend`, run `npm ci`, then `npm run dev`. The health endpoint is `http://localhost:3000/api/health`.
3. To create an admin, set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env`, then run `npm run seed:admin`.
4. Serve the `frontend` folder with an HTTP static server. With VS Code Live Server, open `frontend/index.html` (for example `http://127.0.0.1:5500/frontend/index.html` when the repository root is served, or `http://127.0.0.1:5500/index.html` when `frontend` itself is opened as the workspace). Do not open pages with `file://`. `frontend/asset/js/config.js` points local pages to port 3000; update its production backend URL if your deployment uses another address.
5. Run `npm test` in `backend` for regression checks.

For deployment behind one trusted reverse proxy, set `TRUST_PROXY_HOPS=1`. Keep it `0` when clients connect directly. Rate limits use an in-memory store and apply per server process; use a shared store if deploying multiple backend instances.

## Optional images

Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_BUCKET` in **backend** `.env`; never put the service role key in frontend files. Create a public Storage bucket matching the configured name. The upload route accepts one file up to 5 MB, decodes only JPEG/PNG/WebP, limits image dimensions, and saves a resized WebP. Uploaded files are recorded in `uploaded_images`. An hourly job removes files older than 24 hours that no post references, including abandoned uploads and images from replaced/deleted posts.

## Main routes

| Purpose | Route | Access |
|---|---|---|
| Public posts | `GET /api/posts`, `GET /api/posts/:id` | Visitors; hidden posts excluded |
| New post | `POST /api/posts` | Visitors |
| Find by management code | `POST /api/posts/mine` with `{ "code": "..." }` | Code holder |
| Edit, status, delete | `PUT /api/posts/:id`, `PATCH /api/posts/:id/status`, `DELETE /api/posts/:id` | Management code or admin JWT |
| Ownership claim | `POST /api/claims`, `GET /api/claims/track/:code` | Visitors/code holder |
| Claim administration | `GET /api/claims`, `GET /api/claims/post/:postId`, `PUT /api/claims/:id/status` | Admin |
| Feedback | `POST /api/feedback`, `GET /api/feedback/track/:code` | Visitors/code holder |
| Security report | `POST /api/security-reports`, `GET /api/security-reports/track/:code` | Visitors/code holder |
| Admin login | `POST /api/auth/login`, `GET /api/auth/me` | Admin |
| Admin management | `/api/admin/*`, feedback and security list/update routes | Admin |
| Image upload | `POST /api/uploads` multipart field `image` | Visitors, rate limited |

The public post list accepts `type=lost|found`, `status=active|resolved|closed`, `search`, `category`, `location`, and `sort=newest|oldest|title`. `frontend/asset/js/catalog.js` is shared by browser and server for category and location values. Hidden posts are never returned by the public list or detail routes.

Claim transitions are `pending → approved → completed` or `pending/approved → rejected`. A rejected/completed claim is terminal. Only one claim per post can be approved or completed. Completing a claim resolves the post and rejects other pending claims in the same database transaction. Security reports always begin as investigating; only an admin can mark a patrol dispatched.

## Manual demo checks

- Create LOST and FOUND posts, with and without an image. Save the management code, reload, then use it in “Tin của tôi” to edit and resolve a post.
- Filter every category and location; open a homepage category link and confirm the filter is selected. Edit an event time and confirm its local hour stays the same.
- Hide a post in admin. Confirm public list/detail URLs omit it and its management code cannot make it active again.
- Submit two claims for one found post. Confirm only one can be approved, a pending claim cannot skip to completed, and a rejected claim never shows a pickup code.
- Upload a non-image or oversized file and confirm it is rejected. With the backend unavailable, list/detail pages should show an error rather than sample data.
- Check a 360–390 px viewport and keyboard navigation before release.

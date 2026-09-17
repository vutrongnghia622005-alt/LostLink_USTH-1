# LostLink USTH Admin Guide

Admin is no longer a frontend-only demo account.

## Create an Admin account

Configure these values in `backend/.env`:

```env
ADMIN_NAME=LostLink Admin
ADMIN_EMAIL=admin@usth.edu.vn
ADMIN_PASSWORD=your_private_password
```

Then run:

```bash
cd backend
npm run seed:admin
```

## Login

Open:

```text
/admin/login.html
```

The browser sends the email and password to `POST /api/auth/login`.
The backend verifies the bcrypt hash and returns a JWT only after valid authentication.

## Admin permissions

The backend checks `req.user.role === 'admin'` before protected Admin APIs run.

Admin can:

- view dashboard statistics
- view and moderate posts
- review claims
- approve/reject/complete claims
- view and answer feedback
- view and update security reports

There is no hard-coded Admin password in frontend JavaScript.

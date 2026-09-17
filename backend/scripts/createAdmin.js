require('dotenv').config();

const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function createAdmin() {
    const fullName = String(process.env.ADMIN_NAME || 'LostLink Admin').trim();
    const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = String(process.env.ADMIN_PASSWORD || '');

    if (!email || password.length < 6) {
        console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running this script.');
        process.exitCode = 1;
        return;
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (full_name, email, password_hash, role)
             VALUES ($1, $2, $3, 'admin')
             ON CONFLICT (email)
             DO UPDATE SET
                full_name = EXCLUDED.full_name,
                password_hash = EXCLUDED.password_hash,
                role = 'admin'
             RETURNING id, full_name, email, role`,
            [fullName, email, passwordHash]
        );

        console.log('Admin account ready:', result.rows[0]);
    } catch (error) {
        console.error('Create admin error:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

createAdmin();

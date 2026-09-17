const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const crypto = require('crypto');
const pool = require('../config/database');

function getSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        return null;
    }

    return createClient(url, serviceRoleKey);
}

async function uploadImage(req, res) {
    if (!req.file) {
        return res.status(400).json({ message: 'Please choose an image.' });
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
        return res.status(503).json({
            message: 'Image upload is not configured on the backend yet.'
        });
    }

    const bucket = process.env.SUPABASE_BUCKET || 'lostlink-images';
    let buffer;
    try {
        const image = sharp(req.file.buffer, { limitInputPixels: 40_000_000, failOn: 'error' });
        const metadata = await image.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height ||
            metadata.width > 8000 || metadata.height > 8000) {
            return res.status(400).json({ message: 'Only valid JPEG, PNG or WebP images are allowed.' });
        }
        buffer = await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82 }).toBuffer();
    } catch (error) {
        return res.status(400).json({ message: 'The image could not be decoded.' });
    }

    try {
        const fileName = `guest/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage
            .from(bucket)
            .upload(fileName, buffer, {
                contentType: 'image/webp',
                upsert: false
            });

        if (error) {
            console.error('Supabase upload error:', error);
            return res.status(500).json({ message: 'Could not upload image.' });
        }

        const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);

        try {
            await pool.query('INSERT INTO uploaded_images (path, bucket, public_url) VALUES ($1, $2, $3)',
                [fileName, bucket, data.publicUrl]);
        } catch (databaseFailure) {
            await supabase.storage.from(bucket).remove([fileName]);
            throw databaseFailure;
        }

        res.status(201).json({ imageUrl: data.publicUrl });
    } catch (error) {
        console.error('Upload image error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
}

let cleanupRunning = false;
async function cleanupUnusedImages() {
    const supabase = getSupabaseClient();
    if (!supabase || cleanupRunning) return;
    cleanupRunning = true;
    try {
        const result = await pool.query(`
            SELECT i.path, i.bucket, i.public_url FROM uploaded_images i
            WHERE i.created_at < NOW() - INTERVAL '24 hours'
              AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.image_url = i.public_url)
            ORDER BY i.created_at LIMIT 100
        `);
        for (const image of result.rows) {
            const { error } = await supabase.storage.from(image.bucket).remove([image.path]);
            if (error) {
                console.error('Could not remove unused image:', error);
                continue;
            }
            await pool.query(`DELETE FROM uploaded_images i WHERE i.path = $1
                AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.image_url = i.public_url)`, [image.path]);
        }
    } catch (error) {
        console.error('Unused image cleanup error:', error);
    } finally {
        cleanupRunning = false;
    }
}

function startUploadCleanup() {
    cleanupUnusedImages();
    setInterval(cleanupUnusedImages, 60 * 60 * 1000).unref();
}

module.exports = {
    uploadImage,
    cleanupUnusedImages,
    startUploadCleanup
};

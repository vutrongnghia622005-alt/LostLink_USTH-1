const pool = require('../config/database');
const { isUuid, databaseError } = require('../lib/validation');

async function getDashboard(req, res) {
    try {
        const [posts, feedback, claims, security, recentPosts, recentFeedback] = await Promise.all([
            pool.query(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE type = 'lost')::int AS lost,
                    COUNT(*) FILTER (WHERE type = 'found')::int AS found
                FROM posts
            `),
            pool.query(`
                SELECT COUNT(*) FILTER (WHERE status = 'new')::int AS new_feedback
                FROM feedback
            `),
            pool.query(`
                SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_claims
                FROM claims
            `),
            pool.query(`
                SELECT COUNT(*) FILTER (WHERE status <> 'resolved')::int AS active_security_reports
                FROM security_reports
            `),
            pool.query(`
                SELECT id, title, type, status, location, management_code, created_at
                FROM posts
                ORDER BY created_at DESC
                LIMIT 5
            `),
            pool.query(`
                SELECT id, subject, name, email, status, tracking_code, created_at
                FROM feedback
                ORDER BY created_at DESC
                LIMIT 5
            `)
        ]);

        res.json({
            totalPosts: posts.rows[0].total,
            lostPosts: posts.rows[0].lost,
            foundPosts: posts.rows[0].found,
            newFeedback: feedback.rows[0].new_feedback,
            pendingClaims: claims.rows[0].pending_claims,
            activeSecurityReports: security.rows[0].active_security_reports,
            recentPosts: recentPosts.rows,
            recentFeedback: recentFeedback.rows
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
}

async function getPosts(req, res) {
    try {
        const result = await pool.query(`
            SELECT p.*,
                   COALESCE(u.full_name, p.reporter_name, 'Khách') AS author_name,
                   COALESCE(u.email, p.email) AS author_email
            FROM posts p
            LEFT JOIN users u ON u.id = p.user_id
            ORDER BY p.created_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Admin get posts error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
}

async function updatePostStatus(req, res) {
    const postId = req.params.id;
    if (!isUuid(postId)) return res.status(400).json({ message: 'Invalid post ID.' });
    const status = String(req.body.status || '').trim().toLowerCase();

    if (!['active', 'resolved', 'closed', 'hidden'].includes(status)) {
        return res.status(400).json({ message: 'Invalid post status.' });
    }

    try {
        const result = await pool.query(
            `UPDATE posts
             SET status = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [status, postId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Post not found.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        databaseError(res, error, 'Admin update post status error:');
    }
}

module.exports = {
    getDashboard,
    getPosts,
    updatePostStatus
};

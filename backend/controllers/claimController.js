const crypto = require('crypto');
const pool = require('../config/database');
const { isUuid, isText, databaseError } = require('../lib/validation');

function makeCode(prefix) {
    return `${prefix}-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
}

async function createClaim(req, res) {
    const postId = req.body.postId;
    const studentId = req.body.studentId;
    const contact = req.body.contact;
    const message = req.body.message;
    const answers = req.body.answers;

    if (!isUuid(postId) || !isText(studentId, 1, 40) || !isText(contact, 1, 180) ||
        !isText(message, 10, 800) || !Array.isArray(answers) || answers.length > 3 ||
        answers.some((item) => !item || typeof item !== 'object' || Array.isArray(item) ||
            !isText(item.question, 1, 200) || !isText(item.answer, 0, 250))) {
        return res.status(400).json({
            message: 'Invalid ownership claim.'
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const postResult = await client.query(
            `SELECT id, type, user_id, title, status, verification_questions
             FROM posts
             WHERE id = $1 FOR UPDATE`,
            [postId]
        );

        if (postResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Post not found.' });
        }

        const post = postResult.rows[0];

        if (post.type !== 'found' || post.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Claims can only be created for active found posts.' });
        }

        const duplicate = await client.query(
            `SELECT id
             FROM claims
             WHERE post_id = $1
               AND (UPPER(student_id) = UPPER($2) OR LOWER(contact) = LOWER($3))
               AND status IN ('pending', 'approved')`,
            [postId, studentId.trim(), contact.trim()]
        );

        const requiredQuestions = Array.isArray(post.verification_questions)
            ? post.verification_questions.filter((item) => item && typeof item === 'object' && item.required !== false)
            : [];

        for (const question of requiredQuestions) {
            const matchingAnswer = answers.find((item) => item.question === question.question);

            if (!matchingAnswer || !String(matchingAnswer.answer || '').trim()) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: 'Please answer all required ownership questions.'
                });
            }
        }

        if (duplicate.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'You already have an active claim for this post.' });
        }

        let result;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            result = await client.query(
            `INSERT INTO claims (
                post_id,
                claimer_id,
                student_id,
                contact,
                message,
                answers,
                status,
                tracking_code
             )
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'pending', $7)
             ON CONFLICT (tracking_code) DO NOTHING
             RETURNING *`,
            [postId, null, studentId.trim().toUpperCase(), contact.trim(), message.trim(), JSON.stringify(answers), makeCode('CLM')]
            );
            if (result.rows.length) break;
        }
        if (!result.rows.length) throw new Error('Could not allocate a unique claim code.');

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        databaseError(res, error, 'Create claim error:');
    } finally {
        client.release();
    }
}

async function trackClaim(req, res) {
    const code = String(req.params.code || '').trim().toUpperCase();

    try {
        const result = await pool.query(
            `SELECT
                c.tracking_code,
                c.status,
                CASE WHEN c.status = 'approved' THEN c.pickup_code ELSE NULL END AS pickup_code,
                c.admin_note,
                c.created_at,
                c.updated_at,
                p.title AS post_title
             FROM claims c
             JOIN posts p ON p.id = c.post_id
             WHERE c.tracking_code = $1`,
            [code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Claim not found.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Track claim error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
}

async function getClaimsForPost(req, res) {
    const postId = req.params.postId;
    if (!isUuid(postId)) return res.status(400).json({ message: 'Invalid post ID.' });

    try {
        const postResult = await pool.query(
            'SELECT user_id FROM posts WHERE id = $1',
            [postId]
        );

        if (postResult.rows.length === 0) {
            return res.status(404).json({ message: 'Post not found.' });
        }

        const result = await pool.query(
            `SELECT
                c.*,
                COALESCE(u.full_name, c.student_id, 'Khách') AS claimer_name,
                u.email AS claimer_email
             FROM claims c
             LEFT JOIN users u ON u.id = c.claimer_id
             WHERE c.post_id = $1
             ORDER BY c.created_at DESC`,
            [postId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get claims for post error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
}

async function getAllClaims(req, res) {
    try {
        const result = await pool.query(
            `SELECT
                c.*,
                p.title AS post_title,
                p.verification_questions,
                COALESCE(u.full_name, c.student_id, 'Khách') AS claimer_name,
                u.email AS claimer_email
             FROM claims c
             JOIN posts p ON p.id = c.post_id
             LEFT JOIN users u ON u.id = c.claimer_id
             ORDER BY c.created_at DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get all claims error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
}

async function updateClaimStatus(req, res) {
    const claimId = req.params.id;
    const status = String(req.body.status || '').trim().toLowerCase();
    const adminNote = String(req.body.adminNote || '').trim();

    if (!isUuid(claimId) || !['approved', 'rejected', 'completed'].includes(status) || adminNote.length > 2000) {
        return res.status(400).json({ message: 'Invalid claim status.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const ref = await client.query('SELECT post_id FROM claims WHERE id = $1', [claimId]);
        if (!ref.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Claim not found.' });
        }
        const post = await client.query('SELECT id, status FROM posts WHERE id = $1 FOR UPDATE', [ref.rows[0].post_id]);
        const current = await client.query('SELECT * FROM claims WHERE id = $1 FOR UPDATE', [claimId]);
        if (!post.rows.length || !current.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Claim or post not found.' });
        }
        const from = current.rows[0].status;
        const allowed = (from === 'pending' && ['approved', 'rejected'].includes(status)) ||
            (from === 'approved' && ['completed', 'rejected'].includes(status));
        if (!allowed || (status !== 'rejected' && post.rows[0].status !== 'active')) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'This claim transition is not allowed.' });
        }
        if (status === 'approved') {
            const other = await client.query(
                "SELECT id FROM claims WHERE post_id = $1 AND id <> $2 AND status IN ('approved', 'completed')",
                [ref.rows[0].post_id, claimId]
            );
            if (other.rows.length) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: 'Another claim already owns this post.' });
            }
        }
        const result = await client.query(
            `UPDATE claims
             SET
                status = $1,
                admin_note = $2,
                pickup_code = CASE WHEN $1 = 'approved' THEN $3 WHEN $1 = 'rejected' THEN NULL ELSE pickup_code END,
                updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [status, adminNote || null, status === 'approved' ? makeCode('REC') : null, claimId]
        );

        if (status === 'completed') {
            await client.query(
                `UPDATE posts
                 SET status = 'resolved', updated_at = NOW()
                 WHERE id = $1`,
                [result.rows[0].post_id]
            );
            await client.query(
                "UPDATE claims SET status = 'rejected', pickup_code = NULL, updated_at = NOW() WHERE post_id = $1 AND id <> $2 AND status = 'pending'",
                [result.rows[0].post_id, claimId]
            );
        }

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        databaseError(res, error, 'Update claim status error:');
    } finally {
        client.release();
    }
}

module.exports = {
    createClaim,
    trackClaim,
    getClaimsForPost,
    getAllClaims,
    updateClaimStatus
};

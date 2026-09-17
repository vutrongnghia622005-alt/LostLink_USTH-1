const crypto = require('crypto');
const pool = require('../config/database');
const { isUuid, isText, databaseError } = require('../lib/validation');

function makeTrackingCode() {
    return `SEC-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
}

async function createSecurityReport(req, res) {
    const category = String(req.body.category || '').trim();
    const urgency = String(req.body.urgency || 'normal').trim().toLowerCase();
    const location = String(req.body.location || '').trim();
    const specificLocation = String(req.body.specificLocation || '').trim();
    const description = String(req.body.description || '').trim();
    const anonymous = req.body.anonymous;
    const reporterName = anonymous ? '' : String(req.body.reporterName || '').trim();
    const reporterContact = anonymous ? '' : String(req.body.reporterContact || '').trim();
    const postId = req.body.postId || null;

    if (!['fraudulent_claim', 'theft_tampering', 'unsafe_behavior', 'other'].includes(category) ||
        !['normal', 'urgent'].includes(urgency) || typeof anonymous !== 'boolean' ||
        !isText(req.body.location, 1, 180) || !isText(req.body.specificLocation, 1, 220) ||
        !isText(req.body.description, 20, 900) || (postId && !isUuid(postId))) {
        return res.status(400).json({ message: 'Please provide complete report details.' });
    }

    if (!anonymous && (!isText(req.body.reporterName, 1, 120) || !isText(req.body.reporterContact, 1, 180))) {
        return res.status(400).json({ message: 'Reporter name and contact are required unless anonymous.' });
    }

    try {
        const trackingCode = makeTrackingCode();
        const userId = anonymous ? null : (req.user ? req.user.id : null);
        const initialStatus = 'investigating';

        const result = await pool.query(
            `INSERT INTO security_reports (
                user_id,
                post_id,
                category,
                urgency,
                location,
                specific_location,
                description,
                anonymous,
                reporter_name,
                reporter_contact,
                status,
                tracking_code
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [
                userId,
                postId,
                category,
                urgency,
                location,
                specificLocation,
                description,
                anonymous,
                reporterName || null,
                reporterContact || null,
                initialStatus,
                trackingCode
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        databaseError(res, error, 'Create security report error:');
    }
}

async function trackSecurityReport(req, res) {
    const code = String(req.params.code || '').trim().toUpperCase();

    try {
        const result = await pool.query(
            `SELECT
                tracking_code,
                category,
                urgency,
                location,
                status,
                admin_note,
                created_at,
                updated_at
             FROM security_reports
             WHERE tracking_code = $1`,
            [code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Security report not found.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Track security report error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
}

async function getAllSecurityReports(req, res) {
    try {
        const result = await pool.query(
            `SELECT *
             FROM security_reports
             ORDER BY created_at DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get security reports error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
}

async function updateSecurityReport(req, res) {
    const reportId = req.params.id;
    if (!isUuid(reportId)) return res.status(400).json({ message: 'Invalid report ID.' });
    const status = String(req.body.status || '').trim().toLowerCase();
    const adminNote = String(req.body.adminNote || '').trim();

    if (!['investigating', 'patrol_dispatched', 'resolved'].includes(status) || adminNote.length > 2000) {
        return res.status(400).json({ message: 'Invalid security report status.' });
    }

    try {
        const result = await pool.query(
            `UPDATE security_reports
             SET
                status = $1,
                admin_note = $2,
                updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [status, adminNote || null, reportId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Security report not found.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        databaseError(res, error, 'Update security report error:');
    }
}

module.exports = {
    createSecurityReport,
    trackSecurityReport,
    getAllSecurityReports,
    updateSecurityReport
};

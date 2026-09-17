const crypto = require('crypto');
const pool = require('../config/database');
const catalog = require('../../frontend/asset/js/catalog');
const { isUuid, isText, isOptionalText, databaseError } = require('../lib/validation');

const PUBLIC_POST_FIELDS = `
    p.id,
    p.user_id,
    p.type,
    p.title,
    p.description,
    p.category,
    p.location,
    p.location_detail,
    p.event_date,
    p.image_url,
    p.status,
    p.phone,
    p.email,
    p.high_value,
    p.custody_location,
    p.reporter_name,
    p.reporter_role,
    p.verification_questions,
    p.created_at,
    p.updated_at,
    COALESCE(u.full_name, p.reporter_name, 'Khách') AS author_name
`;

function normalizeType(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
}

function makeManagementCode() {
    return `LL-${crypto.randomInt(10000, 100000)}`;
}

function publicQuestions(questions) {
    if (!Array.isArray(questions)) {
        return [];
    }

    return questions.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        .map((item, index) => ({
            id: typeof item.id === 'string' ? item.id : `q${index + 1}`,
            question: typeof item.question === 'string' ? item.question.trim() : '',
            required: item.required !== false
        })).filter((item) => item.question);
}

function hidePrivatePostData(post) {
    return {
        ...post,
        category: catalog.canonicalCategory(post.category),
        location: catalog.canonicalLocation(post.location),
        verification_questions: publicQuestions(post.verification_questions)
    };
}

function validatePostInput(body) {
    if (!['lost', 'found'].includes(body.type)) return 'Type must be lost or found.';
    if (!isText(body.title, 10, 180)) return 'Title must contain 10 to 180 characters.';
    if (!isText(body.description, 1, 5000)) return 'Description is required (maximum 5000 characters).';
    if (!catalog.categories.includes(body.category)) return 'Invalid category.';
    if (!catalog.locations.includes(body.location)) return 'Invalid location.';
    if (typeof body.eventDate !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(body.eventDate) ||
        Number.isNaN(Date.parse(body.eventDate))) return 'Event date must include a timezone.';
    if (!isText(body.phone, 1, 80)) return 'Contact number is required (maximum 80 characters).';
    if (!isOptionalText(body.email, 180) ||
        (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))) return 'Invalid email.';
    if (!isOptionalText(body.imageUrl, 2000) ||
        (body.imageUrl && !/^https?:\/\//i.test(body.imageUrl))) return 'Invalid image URL.';
    for (const [field, max] of Object.entries({
        locationDetail: 220, custodyLocation: 220, reporterName: 120, reporterRole: 40
    })) {
        if (!isOptionalText(body[field], max)) return `Invalid ${field}.`;
    }
    if (typeof body.highValue !== 'boolean') return 'highValue must be a boolean.';
    if (!Array.isArray(body.verificationQuestions) || body.verificationQuestions.length > 3) {
        return 'At most three verification questions are allowed.';
    }
    for (const item of body.verificationQuestions) {
        if (!item || typeof item !== 'object' || Array.isArray(item) ||
            !isText(item.question, 1, 200) || !isOptionalText(item.hint, 250) ||
            typeof item.required !== 'boolean' ||
            (item.id != null && !isText(item.id, 1, 30))) return 'Invalid verification question.';
    }
    if (body.type === 'found' && !body.verificationQuestions.some((item) => item.required)) {
        return 'Found posts require a verification question.';
    }
    return null;
}

function postInput(body, current = null) {
    const existing = current ? {
        type: current.type, title: current.title, description: current.description,
        category: catalog.canonicalCategory(current.category),
        location: catalog.canonicalLocation(current.location),
        locationDetail: current.location_detail, eventDate: new Date(current.event_date).toISOString(),
        imageUrl: current.image_url, phone: current.phone, email: current.email,
        highValue: current.high_value, custodyLocation: current.custody_location,
        reporterName: current.reporter_name, reporterRole: current.reporter_role,
        verificationQuestions: current.verification_questions
    } : {
        highValue: false, verificationQuestions: [], imageUrl: '', email: '',
        locationDetail: '', custodyLocation: '', reporterName: '', reporterRole: ''
    };
    const fields = Object.keys(existing).concat(['type', 'title', 'description', 'category', 'location', 'eventDate', 'phone']);
    const result = { ...existing };
    for (const field of new Set(fields)) {
        if (Object.prototype.hasOwnProperty.call(body, field)) result[field] = body[field];
    }
    if (typeof result.type === 'string') result.type = normalizeType(result.type);
    if (typeof result.category === 'string') result.category = catalog.canonicalCategory(result.category.trim());
    if (typeof result.location === 'string') result.location = catalog.canonicalLocation(result.location.trim());
    return result;
}

async function getPosts(req, res) {
    const type = normalizeType(req.query.type);
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const location = String(req.query.location || '').trim();
    const requestedStatus = normalizeStatus(req.query.status || 'active');
    const sort = String(req.query.sort || 'newest');

    if (type && !['lost', 'found'].includes(type)) return res.status(400).json({ message: 'Invalid type.' });
    if (!['active', 'resolved', 'closed'].includes(requestedStatus)) {
        return res.status(400).json({ message: 'Invalid public status.' });
    }
    if (category && !catalog.categories.includes(catalog.canonicalCategory(category))) {
        return res.status(400).json({ message: 'Invalid category.' });
    }
    if (location && !catalog.locations.includes(catalog.canonicalLocation(location))) {
        return res.status(400).json({ message: 'Invalid location.' });
    }
    if (search.length > 200 || !['newest', 'oldest', 'title'].includes(sort)) {
        return res.status(400).json({ message: 'Invalid search or sort.' });
    }

    const conditions = ["p.status <> 'hidden'"];
    const values = [];

    if (type) {
        values.push(type);
        conditions.push(`p.type = $${values.length}`);
    }

    if (search) {
        values.push(`%${search}%`);
        conditions.push(`(
            p.title ILIKE $${values.length}
            OR p.description ILIKE $${values.length}
            OR p.location ILIKE $${values.length}
            OR p.category ILIKE $${values.length}
        )`);
    }

    if (category) {
        const canonical = catalog.canonicalCategory(category);
        values.push([canonical, ...Object.keys({ 'Sách vở': 1, 'Phụ kiện': 1 })
            .filter((alias) => catalog.canonicalCategory(alias) === canonical)]);
        conditions.push(`p.category = ANY($${values.length}::text[])`);
    }

    if (location) {
        const canonical = catalog.canonicalLocation(location);
        values.push([canonical, ...['Tòa A21 - USTH', 'Tòa A11', 'Tòa A10 - Tầng 4']
            .filter((alias) => catalog.canonicalLocation(alias) === canonical)]);
        conditions.push(`p.location = ANY($${values.length}::text[])`);
    }

    values.push(requestedStatus);
    conditions.push(`p.status = $${values.length}`);

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    let orderBy = 'ORDER BY p.created_at DESC, p.id DESC';
    if (sort === 'oldest') orderBy = 'ORDER BY p.created_at ASC, p.id ASC';
    if (sort === 'title') orderBy = 'ORDER BY p.title ASC, p.id ASC';

    try {
        const result = await pool.query(
            `SELECT ${PUBLIC_POST_FIELDS}
             FROM posts p
             LEFT JOIN users u ON u.id = p.user_id
             ${whereClause}
             ${orderBy}`,
            values
        );

        res.json(result.rows.map(hidePrivatePostData));
    } catch (error) {
        databaseError(res, error, 'Get posts error:');
    }
}

async function getPostById(req, res) {
    const postId = req.params.id;
    if (!isUuid(postId)) return res.status(400).json({ message: 'Invalid post ID.' });

    try {
        const result = await pool.query(
            `SELECT ${PUBLIC_POST_FIELDS}
             FROM posts p
             LEFT JOIN users u ON u.id = p.user_id
             WHERE p.id = $1 AND p.status <> 'hidden'`,
            [postId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Post not found.' });
        }

        res.json(hidePrivatePostData(result.rows[0]));
    } catch (error) {
        databaseError(res, error, 'Get post error:');
    }
}

async function getMyPosts(req, res) {
    const code = String(req.body.code || '').trim().toUpperCase();

    if (!code) {
        return res.status(400).json({ message: 'Management code is required.' });
    }

    try {
        const result = await pool.query(
            `SELECT
                p.*,
                COALESCE(u.full_name, p.reporter_name, 'Khách') AS author_name
             FROM posts p
             LEFT JOIN users u ON u.id = p.user_id
             WHERE p.management_code = $1
             ORDER BY p.created_at DESC`,
            [code]
        );

        res.json(result.rows);
    } catch (error) {
        databaseError(res, error, 'Get managed post error:');
    }
}

async function createPost(req, res) {
    const input = postInput(req.body || {});
    const validationError = validatePostInput(input);

    if (validationError) {
        return res.status(400).json({ message: validationError });
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await pool.query(
            `INSERT INTO posts (
                user_id,
                type,
                title,
                description,
                category,
                location,
                location_detail,
                event_date,
                image_url,
                status,
                phone,
                email,
                high_value,
                custody_location,
                reporter_name,
                reporter_role,
                verification_questions,
                management_code
             )
             VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, 'active',
                $10, $11, $12, $13, $14, $15, $16::jsonb, $17
             )
             RETURNING *`,
            [
                null,
                input.type,
                input.title.trim(),
                input.description.trim(),
                input.category,
                input.location,
                input.locationDetail?.trim() || null,
                input.eventDate,
                input.imageUrl?.trim() || null,
                input.phone.trim(),
                input.email?.trim() || null,
                input.highValue,
                input.custodyLocation?.trim() || null,
                input.reporterName?.trim() || null,
                input.reporterRole?.trim() || null,
                JSON.stringify(input.verificationQuestions),
                makeManagementCode()
            ]
        );

        return res.status(201).json(result.rows[0]);
      } catch (error) {
        if (error.code === '23505' && error.constraint === 'posts_management_code_key' && attempt < 2) continue;
        return databaseError(res, error, 'Create post error:');
      }
    }
}

async function updatePost(req, res) {
    const postId = req.params.id;
    if (!isUuid(postId)) return res.status(400).json({ message: 'Invalid post ID.' });

    try {
        const currentResult = await pool.query(
            'SELECT * FROM posts WHERE id = $1',
            [postId]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Post not found.' });
        }

        const currentPost = currentResult.rows[0];
        const managementCode = String(
            req.body.managementCode || req.headers['x-management-code'] || ''
        ).trim().toUpperCase();
        const isAdmin = req.user?.role === 'admin';
        const hasValidCode = (
            managementCode &&
            String(currentPost.management_code || '').toUpperCase() === managementCode
        );

        if (!isAdmin && !hasValidCode) {
            return res.status(403).json({
                message: 'Management code is required to edit this post.'
            });
        }

        if (!isAdmin && currentPost.status === 'hidden') {
            return res.status(409).json({ message: 'This post is hidden by an admin.' });
        }

        const input = postInput(req.body || {}, currentPost);
        const validationError = validatePostInput(input);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const result = await pool.query(
            `UPDATE posts
             SET
                type = $1,
                title = $2,
                description = $3,
                category = $4,
                location = $5,
                location_detail = $6,
                event_date = $7,
                image_url = $8,
                phone = $9,
                email = $10,
                high_value = $11,
                custody_location = $12,
                reporter_name = $13,
                reporter_role = $14,
                verification_questions = $15::jsonb,
                updated_at = NOW()
             WHERE id = $16 AND (status <> 'hidden' OR $17)
             RETURNING *`,
            [
                input.type, input.title.trim(), input.description.trim(), input.category,
                input.location, input.locationDetail?.trim() || null, input.eventDate,
                input.imageUrl?.trim() || null, input.phone.trim(), input.email?.trim() || null,
                input.highValue, input.custodyLocation?.trim() || null,
                input.reporterName?.trim() || null, input.reporterRole?.trim() || null,
                JSON.stringify(input.verificationQuestions), postId, isAdmin
            ]
        );

        if (!result.rows.length) return res.status(409).json({ message: 'Post status changed. Reload and try again.' });
        res.json(result.rows[0]);
    } catch (error) {
        databaseError(res, error, 'Update post error:');
    }
}

async function updateOwnPostStatus(req, res) {
    const postId = req.params.id;
    if (!isUuid(postId)) return res.status(400).json({ message: 'Invalid post ID.' });
    const status = normalizeStatus(req.body.status);
    const managementCode = String(
        req.body.managementCode || req.headers['x-management-code'] || ''
    ).trim().toUpperCase();

    if (!['active', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid post status.' });
    }

    try {
        const currentResult = await pool.query(
            'SELECT id, management_code, status FROM posts WHERE id = $1',
            [postId]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Post not found.' });
        }

        const isAdmin = req.user?.role === 'admin';
        const hasValidCode = (
            managementCode &&
            String(currentResult.rows[0].management_code || '').toUpperCase() === managementCode
        );

        if (!isAdmin && !hasValidCode) {
            return res.status(403).json({ message: 'Invalid management code.' });
        }

        if (!isAdmin && currentResult.rows[0].status === 'hidden') {
            return res.status(409).json({ message: 'This post is hidden by an admin.' });
        }

        const result = await pool.query(
            `UPDATE posts
             SET status = $1, updated_at = NOW()
             WHERE id = $2 AND (status <> 'hidden' OR $3)
             RETURNING *`,
            [status, postId, isAdmin]
        );

        if (!result.rows.length) return res.status(409).json({ message: 'Post status changed. Reload and try again.' });
        res.json(result.rows[0]);
    } catch (error) {
        databaseError(res, error, 'Update post status error:');
    }
}

async function deletePost(req, res) {
    const postId = req.params.id;
    if (!isUuid(postId)) return res.status(400).json({ message: 'Invalid post ID.' });
    const managementCode = String(
        req.body?.managementCode || req.headers['x-management-code'] || ''
    ).trim().toUpperCase();

    try {
        const currentResult = await pool.query(
            'SELECT id, management_code, status FROM posts WHERE id = $1',
            [postId]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Post not found.' });
        }

        const isAdmin = req.user?.role === 'admin';
        const hasValidCode = (
            managementCode &&
            String(currentResult.rows[0].management_code || '').toUpperCase() === managementCode
        );

        if (!isAdmin && !hasValidCode) {
            return res.status(403).json({ message: 'Invalid management code.' });
        }

        if (!isAdmin && currentResult.rows[0].status === 'hidden') {
            return res.status(409).json({ message: 'This post is hidden by an admin.' });
        }

        const deleted = await pool.query('DELETE FROM posts WHERE id = $1 AND (status <> \'hidden\' OR $2) RETURNING id', [postId, isAdmin]);
        if (!deleted.rows.length) return res.status(409).json({ message: 'Post status changed. Reload and try again.' });
        res.json({ message: 'Post deleted.' });
    } catch (error) {
        databaseError(res, error, 'Delete post error:');
    }
}

module.exports = {
    getPosts,
    getPostById,
    getMyPosts,
    createPost,
    updatePost,
    updateOwnPostStatus,
    deletePost,
    validatePostInput,
    publicQuestions
};

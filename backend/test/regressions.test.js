const test = require('node:test');
const assert = require('node:assert/strict');

const databasePath = require.resolve('../config/database');
const fakePool = { query: async () => ({ rows: [] }), connect: async () => { throw new Error('not configured'); } };
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: fakePool };

const posts = require('../controllers/postController');
const claims = require('../controllers/claimController');
const admin = require('../controllers/adminController');
const UUID = 'd76ae9fd-2731-4e7c-8d18-ac8f382fdc69';

function response() {
    return {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

test('malformed questions are rejected and old null entries cannot crash public reads', () => {
    const valid = {
        type: 'found', title: 'Found a laptop', description: 'Black laptop',
        category: 'Thiết bị điện tử', location: 'Tòa A21 - USTH Main Building',
        eventDate: '2026-09-16T10:00:00+07:00', phone: '0900000000',
        highValue: false, verificationQuestions: [null]
    };
    assert.equal(posts.validatePostInput(valid), 'Invalid verification question.');
    assert.deepEqual(posts.publicQuestions([null, { question: 'Màu gì?', hint: 'bí mật', required: true }]),
        [{ id: 'q1', question: 'Màu gì?', required: true }]);
});

test('public post queries reject hidden and constrain returned rows', async () => {
    const invalid = response();
    await posts.getPosts({ query: { status: 'hidden' } }, invalid);
    assert.equal(invalid.statusCode, 400);

    let sql = '';
    fakePool.query = async (query) => { sql = query; return { rows: [] }; };
    await posts.getPosts({ query: {} }, response());
    assert.match(sql, /p\.status <> 'hidden'/);
    assert.match(sql, /p\.status = \$1/);
    await posts.getPostById({ params: { id: UUID } }, response());
    assert.match(sql, /p\.id = \$1 AND p\.status <> 'hidden'/);
});

test('management code cannot change a hidden post status', async () => {
    let calls = 0;
    fakePool.query = async () => { calls += 1; return { rows: [{ id: UUID, management_code: 'LL-SECRET', status: 'hidden' }] }; };
    const res = response();
    await posts.updateOwnPostStatus({ params: { id: UUID }, body: { status: 'active', managementCode: 'LL-SECRET' }, headers: {}, user: null }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(calls, 1);
});

test('admin list keeps guest posts with a LEFT JOIN', async () => {
    let sql = '';
    fakePool.query = async (query) => { sql = query; return { rows: [] }; };
    await admin.getPosts({}, response());
    assert.match(sql, /LEFT JOIN users/);
    assert.match(sql, /COALESCE\(u\.full_name, p\.reporter_name/);
});

test('claim handoff rolls back when post update fails', async () => {
    const statements = [];
    fakePool.connect = async () => ({
        release() { statements.push('RELEASE'); },
        async query(sql) {
            statements.push(sql);
            if (sql.startsWith('SELECT post_id')) return { rows: [{ post_id: UUID }] };
            if (sql.startsWith('SELECT id, status FROM posts')) return { rows: [{ id: UUID, status: 'active' }] };
            if (sql.startsWith('SELECT * FROM claims')) return { rows: [{ id: UUID, status: 'approved', post_id: UUID }] };
            if (sql.startsWith('UPDATE claims')) return { rows: [{ id: UUID, status: 'completed', post_id: UUID }] };
            if (sql.includes('UPDATE posts')) throw new Error('simulated database failure');
            return { rows: [] };
        }
    });
    const oldError = console.error;
    console.error = () => {};
    try {
        const res = response();
        await claims.updateClaimStatus({ params: { id: UUID }, body: { status: 'completed' } }, res);
        assert.equal(res.statusCode, 500);
        assert.ok(statements.includes('ROLLBACK'));
        assert.ok(!statements.includes('COMMIT'));
    } finally {
        console.error = oldError;
    }
});

test('pending claim cannot skip approval', async () => {
    const statements = [];
    fakePool.connect = async () => ({
        release() {},
        async query(sql) {
            statements.push(sql);
            if (sql.startsWith('SELECT post_id')) return { rows: [{ post_id: UUID }] };
            if (sql.startsWith('SELECT id, status FROM posts')) return { rows: [{ id: UUID, status: 'active' }] };
            if (sql.startsWith('SELECT * FROM claims')) return { rows: [{ id: UUID, status: 'pending', post_id: UUID }] };
            return { rows: [] };
        }
    });
    const res = response();
    await claims.updateClaimStatus({ params: { id: UUID }, body: { status: 'completed' } }, res);
    assert.equal(res.statusCode, 409);
    assert.ok(!statements.some((sql) => sql.startsWith('UPDATE claims')));
});

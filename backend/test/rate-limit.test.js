const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../server');

test('login blocks repeated attempts with HTTP 429', async () => {
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
        const address = server.address();
        const url = `http://127.0.0.1:${address.port}/api/auth/login`;
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const response = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
            });
            assert.equal(response.status, 400);
        }
        const blocked = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
        });
        assert.equal(blocked.status, 429);
    } finally {
        server.close();
        await once(server, 'close');
    }
});

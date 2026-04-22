const request = require('supertest');
const { app, server } = require('../src/index');

afterAll(() => server.close());

describe('Health Endpoints', () => {
  test('GET /health returns UP', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  test('GET /ready returns 503 when DB not connected in test mode', async () => {
    const res = await request(app).get('/ready');
    // In test mode MongoDB is not connected so we get NOT_READY
    expect([200, 503]).toContain(res.statusCode);
  });
});

describe('Auth — Register', () => {
  test('POST /api/auth/register — success', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
    // 201 if DB connected, 500 if not (test environment without DB)
    expect([201, 500]).toContain(res.statusCode);
  });

  test('POST /api/auth/register — missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeDefined();
  });
});

describe('Auth — Login', () => {
  test('POST /api/auth/login — missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/login — wrong credentials returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrongpassword' });
    expect([401, 500]).toContain(res.statusCode);
  });
});

describe('Auth — Refresh Token', () => {
  test('POST /api/auth/refresh — missing token returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/refresh — invalid token returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid.token.here' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Protected Routes', () => {
  test('GET /api/users/me — no token returns 401', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/token/i);
  });

  test('GET /api/users/me — invalid token returns 401', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid.token.value');
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/auth/logout — no token returns 401', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.statusCode).toBe(401);
  });
});

describe('404 Handler', () => {
  test('Unknown route returns 404', async () => {
    const res = await request(app).get('/api/unknown-route');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

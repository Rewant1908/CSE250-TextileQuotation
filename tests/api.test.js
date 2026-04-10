/**
 * Automated API Test Suite — CSE250 Textile Quotation System
 * Run: npm test
 * Requires: server running on localhost:5000 with kt_impex DB populated
 */

import request from 'supertest';

const BASE = 'http://localhost:5000';

// ─── Track created IDs for cleanup / chaining ────────────────────────────────
let createdUserId;
let createdCustomerId;
let createdQuotationId;
let createdProductId;

// ─── AUTH ─────────────────────────────────────────────────────────────────────
describe('POST /api/signup', () => {
    it('creates a new user and returns user_id', async () => {
        const res = await request(BASE)
            .post('/api/signup')
            .send({ username: `testuser_${Date.now()}`, password: 'test1234', email: 'test@ktimpex.com' });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.user_id).toBeDefined();
        createdUserId = res.body.user_id;
    });

    it('rejects signup with missing password', async () => {
        const res = await request(BASE)
            .post('/api/signup')
            .send({ username: 'nopassuser' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('rejects signup with password shorter than 4 characters', async () => {
        const res = await request(BASE)
            .post('/api/signup')
            .send({ username: 'shortpass', password: '123' });
        expect(res.status).toBe(400);
    });
});

describe('POST /api/login', () => {
    it('admin login returns role=admin', async () => {
        const res = await request(BASE)
            .post('/api/login')
            .send({ username: 'admin', password: 'ktimpex' });
        expect(res.status).toBe(200);
        expect(res.body.role).toBe('admin');
        expect(res.body.user_id).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
        const res = await request(BASE)
            .post('/api/login')
            .send({ username: 'admin', password: 'wrongpass' });
        expect(res.status).toBe(401);
    });

    it('returns 400 when fields are missing', async () => {
        const res = await request(BASE)
            .post('/api/login')
            .send({ username: 'admin' });
        expect(res.status).toBe(400);
    });
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
describe('GET /api/products', () => {
    it('returns array of products', async () => {
        const res = await request(BASE).get('/api/products');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0]).toHaveProperty('product_id');
        expect(res.body[0]).toHaveProperty('product_name');
        expect(res.body[0]).toHaveProperty('category');
        expect(res.body[0]).toHaveProperty('base_price');
    });
});

describe('POST /api/products', () => {
    it('adds a new product and returns product_id', async () => {
        const res = await request(BASE)
            .post('/api/products')
            .send({ product_name: 'Test Fabric', category: 'Denim', base_price: 499.99 });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.product_id).toBeDefined();
        createdProductId = res.body.product_id;
    });

    it('rejects missing fields', async () => {
        const res = await request(BASE)
            .post('/api/products')
            .send({ product_name: 'Incomplete' });
        expect(res.status).toBe(400);
    });
});

describe('PUT /api/products/:id', () => {
    it('updates the test product price', async () => {
        const res = await request(BASE)
            .put(`/api/products/${createdProductId}`)
            .send({ product_name: 'Test Fabric Updated', category: 'Denim', base_price: 599.99 });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

// ─── CUSTOMER ─────────────────────────────────────────────────────────────────
describe('POST /api/enquiry', () => {
    it('registers a customer and returns customer_id', async () => {
        const res = await request(BASE)
            .post('/api/enquiry')
            .send({ customer_name: 'Test Customer', contact_phone: '9876543210', email: 'cust@ktimpex.com' });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.customer_id).toBeDefined();
        createdCustomerId = res.body.customer_id;
    });

    it('rejects invalid phone format', async () => {
        const res = await request(BASE)
            .post('/api/enquiry')
            .send({ customer_name: 'Bad Phone', contact_phone: '12345' });
        expect(res.status).toBe(400);
    });

    it('rejects invalid email format', async () => {
        const res = await request(BASE)
            .post('/api/enquiry')
            .send({ customer_name: 'Bad Email', email: 'notanemail' });
        expect(res.status).toBe(400);
    });

    it('rejects missing customer_name', async () => {
        const res = await request(BASE)
            .post('/api/enquiry')
            .send({ contact_phone: '9876543210' });
        expect(res.status).toBe(400);
    });
});

// ─── QUOTATIONS ───────────────────────────────────────────────────────────────
describe('POST /api/create-quotation', () => {
    it('creates a quotation with items and returns quotation_id', async () => {
        const res = await request(BASE)
            .post('/api/create-quotation')
            .send({
                customer_id: createdCustomerId,
                user_id: createdUserId,
                items: [{ product_id: createdProductId, quantity: 10 }]
            });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.quotation_id).toBeDefined();
        createdQuotationId = res.body.quotation_id;
    });

    it('rejects when items are empty', async () => {
        const res = await request(BASE)
            .post('/api/create-quotation')
            .send({ customer_id: createdCustomerId, items: [] });
        expect(res.status).toBe(400);
    });

    it('rejects invalid product_id', async () => {
        const res = await request(BASE)
            .post('/api/create-quotation')
            .send({ customer_id: createdCustomerId, items: [{ product_id: -1, quantity: 5 }] });
        expect(res.status).toBe(400);
    });

    it('rejects zero quantity', async () => {
        const res = await request(BASE)
            .post('/api/create-quotation')
            .send({ customer_id: createdCustomerId, items: [{ product_id: createdProductId, quantity: 0 }] });
        expect(res.status).toBe(400);
    });
});

describe('GET /api/quotations', () => {
    it('admin gets all quotations', async () => {
        const res = await request(BASE)
            .get('/api/quotations')
            .query({ role: 'admin' });
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('user gets only own quotations', async () => {
        const res = await request(BASE)
            .get('/api/quotations')
            .query({ role: 'user', user_id: createdUserId });
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        res.body.forEach(q => {
            expect(q.quotation_id).toBeDefined();
        });
    });

    it('returns 400 when user role has no user_id', async () => {
        const res = await request(BASE)
            .get('/api/quotations')
            .query({ role: 'user' });
        expect(res.status).toBe(400);
    });
});

describe('GET /api/quotations/:id', () => {
    it('returns single quotation with items, gst_18, and grand_total', async () => {
        const res = await request(BASE)
            .get(`/api/quotations/${createdQuotationId}`);
        expect(res.status).toBe(200);
        expect(res.body.quotation_id).toBe(createdQuotationId);
        expect(res.body.items).toBeDefined();
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.gst_18).toBeDefined();
        expect(res.body.grand_total).toBeDefined();
        expect(res.body.status).toBe('pending');
    });

    it('returns 404 for non-existent quotation', async () => {
        const res = await request(BASE).get('/api/quotations/999999');
        expect(res.status).toBe(404);
    });

    it('returns 400 for invalid quotation ID', async () => {
        const res = await request(BASE).get('/api/quotations/abc');
        expect(res.status).toBe(400);
    });
});

// ─── ADMIN: STATUS ────────────────────────────────────────────────────────────
describe('PATCH /api/quotations/:id/status', () => {
    it('admin accepts a quotation', async () => {
        const res = await request(BASE)
            .patch(`/api/quotations/${createdQuotationId}/status`)
            .send({ status: 'accepted' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('admin declines a quotation with reason', async () => {
        const res = await request(BASE)
            .patch(`/api/quotations/${createdQuotationId}/status`)
            .send({ status: 'declined', decline_reason: 'Stock unavailable at this time.' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('rejects decline without a reason', async () => {
        const res = await request(BASE)
            .patch(`/api/quotations/${createdQuotationId}/status`)
            .send({ status: 'declined' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('rejects invalid status value', async () => {
        const res = await request(BASE)
            .patch(`/api/quotations/${createdQuotationId}/status`)
            .send({ status: 'approved' });
        expect(res.status).toBe(400);
    });
});

// ─── ADMIN: DELETE product (cleanup) ─────────────────────────────────────────
describe('DELETE /api/products/:id', () => {
    it('deletes the test product created earlier', async () => {
        const res = await request(BASE)
            .delete(`/api/products/${createdProductId}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

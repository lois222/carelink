import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server.js';
import User from '../models/User.js';

let mongoServer;

describe('POST /api/users/login', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'validpassword',
      userType: 'family',
      isActive: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('returns 200 and a token for valid credentials', async () => {
    const response = await request(app)
      .post('/api/users/login')
      .send({ email: 'test@example.com', password: 'validpassword' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });

  it('returns 401 for invalid credentials', async () => {
    const response = await request(app)
      .post('/api/users/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(response.status).toBe(401);
  });

  it('returns 400 for missing password', async () => {
    const response = await request(app)
      .post('/api/users/login')
      .send({ email: 'test@example.com' });

    expect(response.status).toBe(400);
  });
});
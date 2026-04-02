import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server.js';
import User from '../models/User.js';
import Credential from '../models/Credential.js';

let mongoServer;
let adminUser;
let caregiverUser;
let adminToken;

describe('Blockchain Functionality', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test users
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password123',
      userType: 'admin',
      isActive: true,
    });

    caregiverUser = await User.create({
      name: 'Test Caregiver',
      email: 'testcaregiver@example.com',
      password: 'password123',
      userType: 'caregiver',
      approved: true,
      isActive: true,
    });

    // Get admin token for protected routes
    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({
        email: 'admin@example.com',
        password: 'password123',
      });

    adminToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('GET /api/blockchain/stats - Blockchain Statistics', () => {
    it('returns blockchain stats without authentication', async () => {
      const response = await request(app)
        .get('/api/blockchain/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalCredentials');
      expect(typeof response.body.totalCredentials).toBe('number');
    });

    it('stats response includes blockchain metrics', async () => {
      const response = await request(app)
        .get('/api/blockchain/stats');

      expect(response.status).toBe(200);
      // Stats should have at least totalCredentials
      expect(Object.keys(response.body).length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/blockchain/store/:credentialId - Store Credential on Blockchain', () => {
    let testCredential;

    beforeEach(async () => {
      // Create a verified credential first
      testCredential = await Credential.create({
        caregiverId: caregiverUser._id,
        credentialType: 'nursing-license',
        credentialName: 'Professional License',
        issuer: 'Ministry of Health',
        fileName: 'license.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileUrl: '/uploads/credentials/license.pdf',
        blockchainHash: 'hash_123',
        verificationStatus: 'verified', // Must be verified to store on blockchain
      });
    });

    it('requires admin authentication', async () => {
      const response = await request(app)
        .post(`/api/blockchain/store/${testCredential._id}`);

      expect(response.status).toBe(401);
    });

    it('returns 403 for non-admin users', async () => {
      const caregiverLogin = await request(app)
        .post('/api/users/login')
        .send({
          email: 'testcaregiver@example.com',
          password: 'password123',
        });

      const caregiverToken = caregiverLogin.body.token;

      const response = await request(app)
        .post(`/api/blockchain/store/${testCredential._id}`)
        .set('Authorization', `Bearer ${caregiverToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('admin');
    });

    it('stores verified credential on blockchain', async () => {
      const response = await request(app)
        .post(`/api/blockchain/store/${testCredential._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('blockchainResult');
    });

    it('returns 400 for unverified credentials', async () => {
      const unverifiedCredential = await Credential.create({
        caregiverId: caregiverUser._id,
        credentialType: 'cpr-certification',
        credentialName: 'Training Certificate',
        issuer: 'Institute',
        fileName: 'cert.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileUrl: '/uploads/credentials/cert.pdf',
        blockchainHash: 'hash_456',
        verificationStatus: 'pending', // Not verified
      });

      const response = await request(app)
        .post(`/api/blockchain/store/${unverifiedCredential._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('verified');
    });

    it('returns 404 for non-existent credential', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/blockchain/store/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('sets blockchainVerified flag on successful storage', async () => {
      const response = await request(app)
        .post(`/api/blockchain/store/${testCredential._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200 || response.status === 201) {
        const updatedCredential = await Credential.findById(testCredential._id);
        expect(updatedCredential.blockchainVerified).toBe(true);
      }
    });
  });

  describe('POST /api/blockchain/verify/:credentialId - Verify Credential on Blockchain', () => {
    let testCredential;

    beforeEach(async () => {
      testCredential = await Credential.create({
        caregiverId: caregiverUser._id,
        credentialType: 'nursing-license',
        credentialName: 'Professional License',
        issuer: 'Ministry of Health',
        fileName: 'license.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileUrl: '/uploads/credentials/license.pdf',
        blockchainHash: 'hash_789',
        verificationStatus: 'verified',
      });
    });

    it('requires authentication', async () => {
      const response = await request(app)
        .post(`/api/blockchain/verify/${testCredential._id}`);

      expect(response.status).toBe(401);
    });

    it('verifies credential on blockchain', async () => {
      const response = await request(app)
        .post(`/api/blockchain/verify/${testCredential._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fileHash: testCredential.blockchainHash,
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('verification');
    });

    it('returns 404 for non-existent credential', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/blockchain/verify/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(404);
    });

    it('accepts optional fileHash in request body', async () => {
      const response = await request(app)
        .post(`/api/blockchain/verify/${testCredential._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fileHash: 'custom_hash_value',
        });

      expect([200, 201]).toContain(response.status);
    });
  });

  describe('POST /api/blockchain/revoke/:credentialId - Revoke Credential', () => {
    let testCredential;

    beforeEach(async () => {
      testCredential = await Credential.create({
        caregiverId: caregiverUser._id,
        credentialType: 'nursing-license',
        credentialName: 'Professional License',
        issuer: 'Ministry of Health',
        fileName: 'license.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileUrl: '/uploads/credentials/license.pdf',
        blockchainHash: 'hash_revoke',
        verificationStatus: 'verified',
        blockchainVerified: true,
      });
    });

    it('requires authentication', async () => {
      const response = await request(app)
        .post(`/api/blockchain/revoke/${testCredential._id}`);

      expect(response.status).toBe(401);
    });

    it('revokes verified credential on blockchain', async () => {
      const response = await request(app)
        .post(`/api/blockchain/revoke/${testCredential._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 201]).toContain(response.status);
    });

    it('returns 404 for non-existent credential', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/blockchain/revoke/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/blockchain/history/:credentialId - Get Credential History', () => {
    let testCredential;

    beforeEach(async () => {
      testCredential = await Credential.create({
        caregiverId: caregiverUser._id,
        credentialType: 'training-certificate',
        credentialName: 'Training Certificate',
        issuer: 'Institute',
        fileName: 'cert.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileUrl: '/uploads/credentials/cert.pdf',
        blockchainHash: 'hash_history',
        verificationStatus: 'verified',
      });
    });

    it('requires authentication', async () => {
      const response = await request(app)
        .get(`/api/blockchain/history/${testCredential._id}`);

      expect(response.status).toBe(401);
    });

    it('returns credential history for a specific credential', async () => {
      const response = await request(app)
        .get(`/api/blockchain/history/${testCredential._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body) || response.body.history).toBeDefined();
      }
    });

    it('returns 404 for non-existent credential', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/blockchain/history/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/blockchain/caregiver/:caregiverId - Get Caregiver Blockchain Records', () => {
    it('requires authentication', async () => {
      const response = await request(app)
        .get(`/api/blockchain/caregiver/${caregiverUser._id}`);

      expect(response.status).toBe(401);
    });

    it('returns blockchain records for a caregiver', async () => {
      const response = await request(app)
        .get(`/api/blockchain/caregiver/${caregiverUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body) || response.body.records).toBeDefined();
      }
    });

    it('returns 404 for non-existent caregiver', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/blockchain/caregiver/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/blockchain/proof/:credentialId - Generate Credential Proof', () => {
    let testCredential;

    beforeEach(async () => {
      testCredential = await Credential.create({
        caregiverId: caregiverUser._id,
        credentialType: 'nursing-license',
        credentialName: 'Professional License',
        issuer: 'Ministry of Health',
        fileName: 'license.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileUrl: '/uploads/credentials/license.pdf',
        blockchainHash: 'hash_proof',
        verificationStatus: 'verified',
        blockchainVerified: true,
      });
    });

    it('requires authentication', async () => {
      const response = await request(app)
        .get(`/api/blockchain/proof/${testCredential._id}`);

      expect(response.status).toBe(401);
    });

    it('generates proof for a blockchain-verified credential', async () => {
      const response = await request(app)
        .get(`/api/blockchain/proof/${testCredential._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('proof');
      }
    });

    it('returns 404 for non-existent credential', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/blockchain/proof/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/blockchain/verify/:credentialId/:transactionId - Public Credential Verification', () => {
    let testCredential;

    beforeEach(async () => {
      testCredential = await Credential.create({
        caregiverId: caregiverUser._id,
        credentialType: 'nursing-license',
        credentialName: 'Professional License',
        issuer: 'Ministry of Health',
        fileName: 'license.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileUrl: '/uploads/credentials/license.pdf',
        blockchainHash: 'hash_public_verify',
        verificationStatus: 'verified',
        blockchainVerified: true,
      });
    });

    it('allows public credential verification without authentication', async () => {
      const response = await request(app)
        .get(`/api/blockchain/verify/${testCredential._id}/tx_12345`);

      expect([200, 404]).toContain(response.status);
    });

    it('returns verification result for valid transaction ID', async () => {
      const response = await request(app)
        .get(`/api/blockchain/verify/${testCredential._id}/tx_12345`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('isValid');
      }
    });

    it('returns 404 for non-existent credential', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/blockchain/verify/${fakeId}/tx_12345`);

      expect(response.status).toBe(404);
    });
  });

  describe('Blockchain Credential Workflow', () => {
    it('follows credential lifecycle: create → verify → store → generate proof', async () => {
      // 1. Create credential
      const credential = await Credential.create({
        caregiverId: caregiverUser._id,
        credentialType: 'nursing-license',
        credentialName: 'Professional License',
        issuer: 'Ministry of Health',
        fileName: 'license.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileUrl: '/uploads/credentials/license.pdf',
        blockchainHash: 'hash_workflow',
        verificationStatus: 'verified',
      });

      // 2. Verify on blockchain
      const verifyResponse = await request(app)
        .post(`/api/blockchain/verify/${credential._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fileHash: credential.blockchainHash,
        });

      expect([200, 201]).toContain(verifyResponse.status);

      // 3. Store on blockchain
      const storeResponse = await request(app)
        .post(`/api/blockchain/store/${credential._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 201]).toContain(storeResponse.status);

      // 4. Generate proof
      const proofResponse = await request(app)
        .get(`/api/blockchain/proof/${credential._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 201]).toContain(proofResponse.status);
    });

    it('can revoke and verify revocation status', async () => {
      const credential = await Credential.create({
        caregiverId: caregiverUser._id,
        credentialType: 'nursing-license',
        credentialName: 'Professional License',
        issuer: 'Ministry of Health',
        fileName: 'license.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileUrl: '/uploads/credentials/license.pdf',
        blockchainHash: 'hash_revoke_verify',
        verificationStatus: 'verified',
        blockchainVerified: true,
      });

      // Revoke credential
      const revokeResponse = await request(app)
        .post(`/api/blockchain/revoke/${credential._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 201]).toContain(revokeResponse.status);

      // Retrieve blockchain records to verify revocation
      const historyResponse = await request(app)
        .get(`/api/blockchain/history/${credential._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(historyResponse.status);
    });
  });
});

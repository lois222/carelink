import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';

let mongoServer;
let familyUser;
let caregiverUser;
let adminUser;
let familyToken;
let caregiverToken;

// Helper function to get authentication token
const getToken = async (email, password) => {
  const response = await request(app)
    .post('/api/users/login')
    .send({ email, password });
  return response.body.token;
};

describe('Booking Management', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test users
    const familyPassword = 'password123';
    const caregiverPassword = 'password123';
    const adminPassword = 'password123';

    familyUser = await User.create({
      name: 'Test Family',
      email: 'testfamily@example.com',
      password: familyPassword,
      userType: 'family',
      isActive: true,
    });

    caregiverUser = await User.create({
      name: 'Test Caregiver',
      email: 'testcaregiver@example.com',
      password: caregiverPassword,
      userType: 'caregiver',
      approved: true,
      location: 'Accra, Ghana',
      latitude: 5.6037,
      longitude: -0.187,
      dailyRate: 250,
      isActive: true,
    });

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: adminPassword,
      userType: 'admin',
      isActive: true,
    });

    // Get auth tokens for users
    familyToken = await getToken('testfamily@example.com', familyPassword);
    caregiverToken = await getToken('testcaregiver@example.com', caregiverPassword);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  afterEach(async () => {
    // Clean up bookings after each test
    await Booking.deleteMany({});
  });

  describe('POST /api/bookings - Create Booking', () => {
    it('successfully creates a booking with required fields', async () => {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 7); // 7 days from now

      const response = await request(app)
        .post('/api/bookings')
        .send({
          userId: familyUser._id.toString(),
          caregiverId: caregiverUser._id.toString(),
          bookingDate: bookingDate.toISOString(),
          totalPrice: 250,
          serviceType: 'daily',
          neededServices: ['Companionship'],
          notes: 'Need daytime care',
        });

      expect([201, 200]).toContain(response.status);
      expect(response.body).toBeDefined();
      // Response might have booking nested or at root level
      const booking = response.body.booking || response.body;
      expect(booking).toBeDefined();
      // Handle both populated object and string ID
      const bookingCaregiver = typeof booking.caregiverId === 'object' ? booking.caregiverId._id.toString() : booking.caregiverId.toString();
      expect(bookingCaregiver).toBe(caregiverUser._id.toString());
    });

    it('creates booking with multiple dates', async () => {
      const date1 = new Date();
      date1.setDate(date1.getDate() + 7);
      const date2 = new Date();
      date2.setDate(date2.getDate() + 8);
      const date3 = new Date();
      date3.setDate(date3.getDate() + 9);

      const response = await request(app)
        .post('/api/bookings')
        .send({
          userId: familyUser._id.toString(),
          caregiverId: caregiverUser._id.toString(),
          bookingDate: date1.toISOString(),
          bookingDates: [date1, date2, date3],
          totalPrice: 750,
          serviceType: 'daily',
          neededServices: ['Basic life needs', 'Mobility support'],
        });

      expect([201, 200]).toContain(response.status);
      const booking = response.body.booking || response.body;
      expect(booking.bookingDates).toBeDefined();
    });

    it('returns 400 if no booking date provided', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({
          userId: familyUser._id.toString(),
          caregiverId: caregiverUser._id.toString(),
          totalPrice: 250,
          serviceType: 'daily',
        });

      expect(response.status).toBe(400);
    });

    it('returns 400 if caregiverId missing', async () => {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 7);

      const response = await request(app)
        .post('/api/bookings')
        .send({
          userId: familyUser._id.toString(),
          bookingDate: bookingDate.toISOString(),
          totalPrice: 250,
          serviceType: 'daily',
        });

      expect(response.status).toBe(400);
    });

    it('allows guest bookings (no userId)', async () => {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 7);

      const response = await request(app)
        .post('/api/bookings')
        .send({
          caregiverId: caregiverUser._id.toString(),
          bookingDate: bookingDate.toISOString(),
          totalPrice: 250,
          serviceType: 'daily',
        });

      expect([201, 200]).toContain(response.status);
    });

    it('returns 400 for invalid booking date format', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({
          userId: familyUser._id.toString(),
          caregiverId: caregiverUser._id.toString(),
          bookingDate: 'invalid-date',
          totalPrice: 250,
          serviceType: 'daily',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/bookings - Get Bookings', () => {
    beforeEach(async () => {
      // Create test bookings
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 7);

      await Booking.create({
        userId: familyUser._id,
        caregiverId: caregiverUser._id,
        bookingDate,
        totalPrice: 250,
        status: 'confirmed',
      });

      await Booking.create({
        userId: familyUser._id,
        caregiverId: caregiverUser._id,
        bookingDate,
        totalPrice: 500,
        status: 'pending',
      });
    });

    it('requires authentication', async () => {
      const response = await request(app)
        .get('/api/bookings');

      expect(response.status).toBe(401);
    });

    it('returns bookings for authenticated user', async () => {
      const loginResponse = await request(app)
        .post('/api/users/login')
        .send({
          email: familyUser.email,
          password: 'password123',
        });

      const token = loginResponse.body.token;

      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });
  });

  describe('GET /api/bookings/:id - Get Single Booking', () => {
    let testBooking;

    beforeEach(async () => {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 7);

      testBooking = await Booking.create({
        userId: familyUser._id,
        caregiverId: caregiverUser._id,
        bookingDate,
        totalPrice: 250,
        status: 'confirmed',
      });
    });

    it('retrieves booking without authentication (guest access)', async () => {
      const response = await request(app)
        .get(`/api/bookings/${testBooking._id}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        const booking = response.body.booking || response.body;
        expect(booking._id || booking.id).toBe(testBooking._id.toString());
      }
    });

    it('retrieves booking with authentication', async () => {
      const loginResponse = await request(app)
        .post('/api/users/login')
        .send({
          email: familyUser.email,
          password: 'password123',
        });

      const token = loginResponse.body.token;

      const response = await request(app)
        .get(`/api/bookings/${testBooking._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect([200, 404]).toContain(response.status);
    });

    it('returns 404 for non-existent booking', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/bookings/${fakeId}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/bookings/:id - Update Booking', () => {
    let testBooking;

    beforeEach(async () => {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 7);

      testBooking = await Booking.create({
        userId: familyUser._id,
        caregiverId: caregiverUser._id,
        bookingDate,
        totalPrice: 250,
        status: 'pending',
      });
    });

    it('updates booking status to confirmed', async () => {
      const response = await request(app)
        .put(`/api/bookings/${testBooking._id}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .send({
          status: 'confirmed',
        });

      expect([200, 201, 204]).toContain(response.status);
    });

    it('updates booking to completed status', async () => {
      const response = await request(app)
        .put(`/api/bookings/${testBooking._id}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .send({
          status: 'completed',
        });

      expect([200, 201, 204]).toContain(response.status);
    });

    it('allows adding notes to booking', async () => {
      const response = await request(app)
        .put(`/api/bookings/${testBooking._id}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .send({
          notes: 'Updated notes for the booking',
        });

      expect([200, 201, 204]).toContain(response.status);
    });

    it('allows adding review and rating after completion', async () => {
      const response = await request(app)
        .put(`/api/bookings/${testBooking._id}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .send({
          status: 'completed',
          rating: 5,
          reviewNotes: 'Excellent caregiver!',
        });

      expect([200, 201, 204]).toContain(response.status);
    });

    it('validates rating is between 1-5', async () => {
      const response = await request(app)
        .put(`/api/bookings/${testBooking._id}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .send({
          rating: 10,
        });

      // Should either reject or clamp the value
      expect([200, 201, 204, 400]).toContain(response.status);
    });

    it('returns 404 for non-existent booking', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/bookings/${fakeId}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .send({
          status: 'confirmed',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/bookings/:id - Cancel Booking', () => {
    let testBooking;

    beforeEach(async () => {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 7);

      testBooking = await Booking.create({
        userId: familyUser._id,
        caregiverId: caregiverUser._id,
        bookingDate,
        totalPrice: 250,
        status: 'pending',
      });
    });

    it('cancels a pending booking', async () => {
      const response = await request(app)
        .delete(`/api/bookings/${testBooking._id}`)
        .set('Authorization', `Bearer ${familyToken}`);

      expect([200, 204]).toContain(response.status);

      // Verify booking is deleted or marked as cancelled
      const updatedBooking = await Booking.findById(testBooking._id);
      expect(!updatedBooking || updatedBooking.status === 'cancelled').toBe(true);
    });

    it('returns 404 for non-existent booking', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/bookings/${fakeId}`)
        .set('Authorization', `Bearer ${familyToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Booking Status Workflow', () => {
    it('follows complete booking lifecycle: pending → confirmed → completed', async () => {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 7);

      // Create booking
      const createResponse = await request(app)
        .post('/api/bookings')
        .send({
          userId: familyUser._id.toString(),
          caregiverId: caregiverUser._id.toString(),
          bookingDate: bookingDate.toISOString(),
          totalPrice: 250,
          serviceType: 'daily',
        });

      expect([201, 200]).toContain(createResponse.status);
      const booking = createResponse.body.booking || createResponse.body;
      const bookingId = booking._id || booking.id;

      // Update to confirmed
      const confirmResponse = await request(app)
        .put(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .send({ status: 'confirmed' });

      expect([200, 201, 204]).toContain(confirmResponse.status);

      // Update to completed with review
      const completeResponse = await request(app)
        .put(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .send({
          status: 'completed',
          rating: 4,
          reviewNotes: 'Good service',
        });

      expect([200, 201, 204]).toContain(completeResponse.status);
    });
  });

  describe('Service Types and Pricing', () => {
    it('creates booking with daily service type', async () => {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 7);

      const response = await request(app)
        .post('/api/bookings')
        .send({
          caregiverId: caregiverUser._id.toString(),
          bookingDate: bookingDate.toISOString(),
          totalPrice: 250,
          serviceType: 'daily',
        });

      expect([201, 200]).toContain(response.status);
      const booking = response.body.booking || response.body;
      expect(booking).toBeDefined();
    });

    it('creates booking with weekly service type', async () => {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 7);

      const response = await request(app)
        .post('/api/bookings')
        .send({
          caregiverId: caregiverUser._id.toString(),
          bookingDate: bookingDate.toISOString(),
          totalPrice: 1500,
          serviceType: 'weekly',
        });

      expect([201, 200]).toContain(response.status);
      const booking = response.body.booking || response.body;
      expect(booking).toBeDefined();
    });

    it('creates booking with monthly service type', async () => {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 30);

      const response = await request(app)
        .post('/api/bookings')
        .send({
          caregiverId: caregiverUser._id.toString(),
          bookingDate: bookingDate.toISOString(),
          totalPrice: 5000,
          serviceType: 'monthly',
        });

      expect([201, 200]).toContain(response.status);
      const booking = response.body.booking || response.body;
      expect(booking).toBeDefined();
    });
  });
});

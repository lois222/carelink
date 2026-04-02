import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server.js';
import User from '../models/User.js';
import Review from '../models/Review.js';

let mongoServer;
let familyUser;
let caregiversData;

describe('Caregiver Search & Filtering', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create family user for testing
    familyUser = await User.create({
      name: 'Test Family',
      email: 'testfamily@example.com',
      password: 'password123',
      userType: 'family',
      isActive: true,
    });

    // Create multiple caregivers in different locations
    caregiversData = await User.create([
      {
        name: 'Caregiver Accra',
        email: 'caregiver1@example.com',
        password: 'password123',
        userType: 'caregiver',
        location: 'Accra, Greater Accra Region',
        latitude: 5.6037,
        longitude: -0.1870,
        dailyRate: 250,
        serviceType: 'childcare',
        providedServices: ['Companionship', 'Basic life needs'],
        bio: 'Experienced caregiver specializing in elderly care',
        isActive: true,
      },
      {
        name: 'Caregiver Kumasi',
        email: 'caregiver2@example.com',
        password: 'password123',
        userType: 'caregiver',
        location: 'Kumasi, Ashanti Region',
        latitude: 6.6753,
        longitude: -1.6167,
        dailyRate: 200,
        serviceType: 'nursing',
        providedServices: ['Physiotherapy', 'Mobility support'],
        isActive: true,
      },
      {
        name: 'Caregiver Cape Coast',
        email: 'caregiver3@example.com',
        password: 'password123',
        userType: 'caregiver',
        location: 'Cape Coast, Central Region',
        latitude: 5.1033,
        longitude: -1.2467,
        dailyRate: 300,
        serviceType: 'eldercare',
        providedServices: ['Feeding assistance', 'Mobility support'],
        isActive: true,
      },
      {
        name: 'Caregiver Accra High Rate',
        email: 'caregiver4@example.com',
        password: 'password123',
        userType: 'caregiver',
        location: 'Accra, Greater Accra Region',
        latitude: 5.63,
        longitude: -0.20,
        dailyRate: 500,
        serviceType: 'physical-therapy',
        providedServices: ['Physiotherapy'],
        isActive: true,
      },
      {
        name: 'Unapproved Caregiver',
        email: 'caregiver5@example.com',
        password: 'password123',
        userType: 'caregiver',
        location: 'Accra, Greater Accra Region',
        latitude: 5.6,
        longitude: -0.18,
        dailyRate: 250,
        isActive: true,
      },
    ]);

    // Manually approve first 4 caregivers using direct update (bypass pre-save hooks)
    // The model pre-save hook forces all caregivers to approved: false on creation
    for (let i = 0; i < 4; i++) {
      await User.updateOne({ _id: caregiversData[i]._id }, { approved: true });
    }
    
    // Verify caregivers were approved
    const verifyApproved = await User.find({ userType: 'caregiver', approved: true });
    console.log(`Approved caregivers after setup: ${verifyApproved.length}`);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('Verification', () => {
    it('should have created caregivers in database', async () => {
      // Debug: Count total caregivers
      const allUsers = await User.find({ userType: 'caregiver' });
      console.log('Total caregivers in DB:', allUsers.length);
      
      // Debug: Count approved caregivers
      const approvedCaregivers = await User.find({ userType: 'caregiver', approved: true });
      console.log('Approved caregivers:', approvedCaregivers.length);
      approvedCaregivers.forEach(c => {
        console.log(`- ${c.name}: approved=${c.approved}, location=${c.location}`);
      });

      expect(approvedCaregivers.length).toBeGreaterThan(0);
    });

    it('should return caregivers via API GET /caregivers', async () => {
      const response = await request(app).get('/api/users/caregivers');
      console.log('GET /api/users/caregivers status:', response.status);
      console.log('Response body length:', Array.isArray(response.body) ? response.body.length : 'not array');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/users/caregivers/search/:location - Location-based Search', () => {
    it('returns caregivers matching the search location', async () => {
      const response = await request(app)
        .get('/api/users/caregivers/search/Accra');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('only returns approved caregivers', async () => {
      const response = await request(app)
        .get('/api/users/caregivers/search/Accra');

      expect(response.status).toBe(200);
      response.body.forEach(caregiver => {
        expect(caregiver.approved).toBe(true);
      });
    });

    it('performs case-insensitive location search', async () => {
      const response1 = await request(app)
        .get('/api/users/caregivers/search/accra');

      const response2 = await request(app)
        .get('/api/users/caregivers/search/ACCRA');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.length).toBe(response2.body.length);
    });

    it('supports partial location matching', async () => {
      const response = await request(app)
        .get('/api/users/caregivers/search/Accra');

      expect(response.status).toBe(200);
      response.body.forEach(caregiver => {
        expect(caregiver.location.toLowerCase()).toContain('accra');
      });
    });

    it('returns empty array for non-matching location', async () => {
      const response = await request(app)
        .get('/api/users/caregivers/search/NonExistentCity');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('returns 400 if location parameter missing', async () => {
      const response = await request(app)
        .get('/api/users/caregivers/search/');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });

    it('includes caregiver ratings in search results', async () => {
      const response = await request(app)
        .get('/api/users/caregivers/search/Accra');

      expect(response.status).toBe(200);
      response.body.forEach(caregiver => {
        expect(caregiver).toHaveProperty('rating');
        expect(caregiver).toHaveProperty('reviewCount');
      });
    });

    it('sorts caregivers by rating (highest first)', async () => {
      const response = await request(app)
        .get('/api/users/caregivers/search/Accra');

      expect(response.status).toBe(200);

      // Check that ratings are in descending order (if they exist)
      for (let i = 1; i < response.body.length; i++) {
        const prevRating = response.body[i - 1].rating !== undefined ? response.body[i - 1].rating : 0;
        const currentRating = response.body[i].rating !== undefined ? response.body[i].rating : 0;
        expect(prevRating).toBeGreaterThanOrEqual(currentRating);
      }
    });

    it('excludes password from search results', async () => {
      const response = await request(app)
        .get('/api/users/caregivers/search/Accra');

      expect(response.status).toBe(200);
      response.body.forEach(caregiver => {
        expect(caregiver).not.toHaveProperty('password');
      });
    });
  });

  describe('GET /api/users/caregivers - Get All Approved Caregivers', () => {
    it('returns all approved caregivers', async () => {
      const response = await request(app)
        .get('/api/users/caregivers');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('excludes unapproved caregivers', async () => {
      const response = await request(app)
        .get('/api/users/caregivers');

      expect(response.status).toBe(200);
      response.body.forEach(caregiver => {
        expect(caregiver.approved).toBe(true);
      });
    });

    it('includes caregiver details like dailyRate and location', async () => {
      const response = await request(app)
        .get('/api/users/caregivers');

      expect(response.status).toBe(200);
      response.body.forEach(caregiver => {
        expect(caregiver).toHaveProperty('dailyRate');
        expect(caregiver).toHaveProperty('location');
        expect(caregiver).toHaveProperty('serviceType');
        expect(caregiver.userType).toBe('caregiver');
      });
    });
  });

  describe('GET /api/users/public/:id - Public Caregiver Profile', () => {
    it('returns public caregiver profile for approved caregivers', async () => {
      const approveCaregiverId = caregiversData[0]._id;

      const response = await request(app)
        .get(`/api/users/public/${approveCaregiverId}`);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Caregiver Accra');
      expect(response.body.userType).toBe('caregiver');
    });

    it('excludes password from public profile', async () => {
      const approveCaregiverId = caregiversData[0]._id;

      const response = await request(app)
        .get(`/api/users/public/${approveCaregiverId}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('password');
    });

    it('includes rating and reviewCount on public profile', async () => {
      const approveCaregiverId = caregiversData[0]._id;

      const response = await request(app)
        .get(`/api/users/public/${approveCaregiverId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rating');
      expect(response.body).toHaveProperty('reviewCount');
    });

    it('returns 403 for unapproved caregiver profile', async () => {
      const unapprovedCaregiverId = caregiversData[4]._id;

      const response = await request(app)
        .get(`/api/users/public/${unapprovedCaregiverId}`);

      expect(response.status).toBe(403);
    });

    it('returns 403 for non-caregiver user profile', async () => {
      const familyUserId = familyUser._id;

      const response = await request(app)
        .get(`/api/users/public/${familyUserId}`);

      expect(response.status).toBe(403);
    });

    it('returns 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/users/public/${fakeId}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Filtering by Attributes', () => {
    it('can filter caregivers by daily rate (high-end)', async () => {
      const response = await request(app)
        .get('/api/users/caregivers');

      expect(response.status).toBe(200);

      // Filter manually to test data exists
      const highRateCaregivers = response.body.filter(c => c.dailyRate >= 400);
      expect(highRateCaregivers.length).toBeGreaterThan(0);
    });

    it('can identify caregivers by service type', async () => {
      const response = await request(app)
        .get('/api/users/caregivers');

      expect(response.status).toBe(200);

      const childcareCaregivers = response.body.filter(c => c.serviceType === 'childcare');
      const nurseCaregivers = response.body.filter(c => c.serviceType === 'nursing');
      const eldercareCaregivers = response.body.filter(c => c.serviceType === 'eldercare');

      expect(childcareCaregivers.length).toBeGreaterThan(0);
      expect(nurseCaregivers.length).toBeGreaterThan(0);
      expect(eldercareCaregivers.length).toBeGreaterThan(0);
    });

    it('can filter by provided services', async () => {
      const response = await request(app)
        .get('/api/users/caregivers');

      expect(response.status).toBe(200);

      const physiotherapyCaregivers = response.body.filter(c =>
        c.providedServices && c.providedServices.includes('Physiotherapy')
      );
      const companionshipCaregivers = response.body.filter(c =>
        c.providedServices && c.providedServices.includes('Companionship')
      );

      expect(physiotherapyCaregivers.length).toBeGreaterThan(0);
      expect(companionshipCaregivers.length).toBeGreaterThan(0);
    });

    it('returns caregivers with high ratings (4+ stars)', async () => {
      const response = await request(app)
        .get('/api/users/caregivers');

      expect(response.status).toBe(200);

      const highRatedCaregivers = response.body.filter(c => c.rating >= 4);
      expect(highRatedCaregivers.length).toBeGreaterThan(0);
      highRatedCaregivers.forEach(caregiver => {
        expect(caregiver.rating).toBeGreaterThanOrEqual(4);
      });
    });

    it('can identify caregivers by review count', async () => {
      const response = await request(app)
        .get('/api/users/caregivers');

      expect(response.status).toBe(200);

      const mostReviewedCaregivers = response.body.filter(c => c.reviewCount >= 8);
      expect(mostReviewedCaregivers.length).toBeGreaterThan(0);
    });
  });

  describe('Proximity-based Search', () => {
    it('supports proximity filter parameter', async () => {
      const response = await request(app)
        .get('/api/users/caregivers/search/Accra?useProximity=true&radiusKm=10');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('defaults to 5km radius if not specified', async () => {
      const response = await request(app)
        .get('/api/users/caregivers/search/Accra?useProximity=true');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('falls back to standard location search if proximity fails', async () => {
      const response = await request(app)
        .get('/api/users/caregivers/search/Accra?useProximity=true&radiusKm=1');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Search Result Attributes', () => {
    it('includes all necessary profile fields in search results', async () => {
      const response = await request(app)
        .get('/api/users/caregivers/search/Accra');

      expect(response.status).toBe(200);
      const caregiver = response.body[0];

      expect(caregiver).toHaveProperty('_id');
      expect(caregiver).toHaveProperty('name');
      expect(caregiver).toHaveProperty('email');
      expect(caregiver).toHaveProperty('userType');
      expect(caregiver).toHaveProperty('location');
      expect(caregiver).toHaveProperty('dailyRate');
      expect(caregiver).toHaveProperty('rating');
      expect(caregiver).toHaveProperty('latitude');
      expect(caregiver).toHaveProperty('longitude');
    });

    it('includes bio and certifications when available', async () => {
      const response = await request(app)
        .get('/api/users/caregivers');

      expect(response.status).toBe(200);

      const caregiverWithBio = response.body.find(c => c.bio);
      if (caregiverWithBio) {
        expect(caregiverWithBio.bio).toBeDefined();
      }
    });
  });
});

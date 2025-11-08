// Import setup (must be first so lifecycle hooks run before tests)
import './setupMongo.js';
import { jest } from '@jest/globals';
jest.setTimeout(30000);

// then other imports
import Restaurant from '../src/models/Restaurant.js';
import {
  getAllRestaurants,
  getRestaurantById,
  deleteRestaurant,
  updateRestaurant
} from '../src/controllers/superAdminController.js';

// Mock dependencies
const mockRestaurant = Restaurant;

beforeEach(async () => {
  await Restaurant.deleteMany({});
  jest.clearAllMocks();
});

afterEach(async () => {
  await Restaurant.deleteMany({});
});

describe('SuperAdminController - Unit Tests (QA Coverage Analysis)', () => {

  // Test 1: getAllRestaurants() | error | Role authorization check - non-superAdmin access (403)
  test('Test 1: getAllRestaurants() should return 403 when user is not superAdmin (critical security boundary)', async () => {
    // GIVEN: A request object with non-superAdmin user role (customer)
    const mockReq = {
      user: {
        id: 'user123',
        role: 'customer', // Not superAdmin
        name: 'Regular Customer'
      }
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: getAllRestaurants is called with non-superAdmin user
    await getAllRestaurants(mockReq, mockRes);
    
    // THEN: Should return 403 with access denied message (critical security boundary protected)
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Access denied, only Super Admin can access this resource'
    });
    expect(mockRes.status).toHaveBeenCalledTimes(1);
    expect(mockRes.json).toHaveBeenCalledTimes(1);
    
    // GIVEN: A request object with restaurantAdmin role
    const mockReqRestaurantAdmin = {
      user: {
        id: 'admin456',
        role: 'restaurantAdmin',
        name: 'Restaurant Admin'
      }
    };
    
    const mockResRestaurantAdmin = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: getAllRestaurants is called with restaurantAdmin
    await getAllRestaurants(mockReqRestaurantAdmin, mockResRestaurantAdmin);
    
    // THEN: Should also return 403 (only superAdmin allowed)
    expect(mockResRestaurantAdmin.status).toHaveBeenCalledWith(403);
    expect(mockResRestaurantAdmin.json).toHaveBeenCalledWith({
      message: 'Access denied, only Super Admin can access this resource'
    });
    
    // GIVEN: A request object with undefined role (null pointer risk)
    const mockReqNoRole = {
      user: {
        id: 'user789',
        name: 'User Without Role'
        // role is undefined
      }
    };
    
    const mockResNoRole = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: getAllRestaurants is called with undefined role
    await getAllRestaurants(mockReqNoRole, mockResNoRole);
    
    // THEN: Should return 403 (handles undefined role gracefully)
    expect(mockResNoRole.status).toHaveBeenCalledWith(403);
    expect(mockResNoRole.json).toHaveBeenCalledWith({
      message: 'Access denied, only Super Admin can access this resource'
    });
  });

  // Test 2: getRestaurantById() | error | Role authorization check - non-superAdmin access (403)
  test('Test 2: getRestaurantById() should return 403 when user is not superAdmin (critical security boundary)', async () => {
    // GIVEN: An existing restaurant in database and non-superAdmin user
    const testRestaurant = new Restaurant({
      name: 'Test Restaurant',
      ownerName: 'Test Owner',
      location: 'Test Location',
      contactNumber: '1234567890',
      admin: {
        email: 'test@restaurant.com',
        password: 'TestPass123!'
      }
    });
    await testRestaurant.save();
    
    const mockReq = {
      user: {
        id: 'user123',
        role: 'deliveryPersonnel', // Not superAdmin
        name: 'Delivery Person'
      },
      params: {
        id: testRestaurant._id.toString()
      }
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: getRestaurantById is called with non-superAdmin user
    await getRestaurantById(mockReq, mockRes);
    
    // THEN: Should return 403 without exposing restaurant data (critical security boundary)
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Access denied, only Super Admin can access this resource'
    });
    expect(mockRes.status).toHaveBeenCalledTimes(1);
    expect(mockRes.json).toHaveBeenCalledTimes(1);
    
    // Verify restaurant data was not leaked in response
    expect(mockRes.json).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Restaurant' })
    );
    
    // GIVEN: Request with null user role (null pointer risk)
    const mockReqNullRole = {
      user: {
        id: 'user456',
        role: null,
        name: 'Null Role User'
      },
      params: {
        id: testRestaurant._id.toString()
      }
    };
    
    const mockResNullRole = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: getRestaurantById is called with null role
    await getRestaurantById(mockReqNullRole, mockResNullRole);
    
    // THEN: Should return 403 (handles null role without crash)
    expect(mockResNullRole.status).toHaveBeenCalledWith(403);
    expect(mockResNullRole.json).toHaveBeenCalledWith({
      message: 'Access denied, only Super Admin can access this resource'
    });
  });

  // Test 3: deleteRestaurant() | error | Role authorization check - non-superAdmin access (403)
  test('Test 3: deleteRestaurant() should return 403 when user is not superAdmin (critical security boundary)', async () => {
    // GIVEN: An existing restaurant in database and non-superAdmin user
    const testRestaurant = new Restaurant({
      name: 'Restaurant To Not Delete',
      ownerName: 'Safe Owner',
      location: 'Safe Location',
      contactNumber: '9876543210',
      admin: {
        email: 'safe@restaurant.com',
        password: 'SafePass123!'
      }
    });
    await testRestaurant.save();
    
    const mockReq = {
      user: {
        id: 'user123',
        role: 'restaurantAdmin', // Not superAdmin but might seem privileged
        name: 'Restaurant Admin'
      },
      params: {
        id: testRestaurant._id.toString()
      }
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: deleteRestaurant is called with non-superAdmin user
    await deleteRestaurant(mockReq, mockRes);
    
    // THEN: Should return 403 and NOT delete restaurant (critical security boundary - prevents unauthorized deletion)
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Access denied, only Super Admin can access this resource'
    });
    
    // Verify restaurant still exists in database (was not deleted)
    const restaurantStillExists = await Restaurant.findById(testRestaurant._id);
    expect(restaurantStillExists).toBeDefined();
    expect(restaurantStillExists.name).toBe('Restaurant To Not Delete');
    
    // GIVEN: Request with empty string role (edge case)
    const mockReqEmptyRole = {
      user: {
        id: 'user456',
        role: '',
        name: 'Empty Role User'
      },
      params: {
        id: testRestaurant._id.toString()
      }
    };
    
    const mockResEmptyRole = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: deleteRestaurant is called with empty string role
    await deleteRestaurant(mockReqEmptyRole, mockResEmptyRole);
    
    // THEN: Should return 403 (handles empty string role)
    expect(mockResEmptyRole.status).toHaveBeenCalledWith(403);
    expect(mockResEmptyRole.json).toHaveBeenCalledWith({
      message: 'Access denied, only Super Admin can access this resource'
    });
    
    // Verify restaurant still exists after second unauthorized attempt
    const restaurantStillExistsAfter = await Restaurant.findById(testRestaurant._id);
    expect(restaurantStillExistsAfter).toBeDefined();
  });

  // Test 4: updateRestaurant() | error | Role authorization check - non-superAdmin access (403)
  test('Test 4: updateRestaurant() should return 403 when user is not superAdmin (critical security boundary)', async () => {
    // GIVEN: An existing restaurant in database and non-superAdmin user
    const testRestaurant = new Restaurant({
      name: 'Original Restaurant Name',
      ownerName: 'Original Owner',
      location: 'Original Location',
      contactNumber: '1111111111',
      admin: {
        email: 'original@restaurant.com',
        password: 'OriginalPass123!'
      }
    });
    await testRestaurant.save();
    
    const mockReq = {
      user: {
        id: 'user123',
        role: 'customer', // Not superAdmin
        name: 'Regular Customer'
      },
      params: {
        id: testRestaurant._id.toString()
      },
      body: {
        name: 'Malicious New Name',
        ownerName: 'Malicious Owner',
        location: 'Malicious Location'
      }
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: updateRestaurant is called with non-superAdmin user
    await updateRestaurant(mockReq, mockRes);
    
    // THEN: Should return 403 and NOT update restaurant (critical security boundary - prevents unauthorized modification)
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Access denied, only Super Admin can update restaurants'
    });
    
    // Verify restaurant data remains unchanged in database
    const restaurantUnchanged = await Restaurant.findById(testRestaurant._id);
    expect(restaurantUnchanged).toBeDefined();
    expect(restaurantUnchanged.name).toBe('Original Restaurant Name');
    expect(restaurantUnchanged.ownerName).toBe('Original Owner');
    expect(restaurantUnchanged.location).toBe('Original Location');
    
    // GIVEN: Request with role that looks similar to superAdmin (typo attack)
    const mockReqTypoRole = {
      user: {
        id: 'user456',
        role: 'superadmin', // lowercase - not exact match
        name: 'Fake Admin'
      },
      params: {
        id: testRestaurant._id.toString()
      },
      body: {
        name: 'Another Malicious Name'
      }
    };
    
    const mockResTypoRole = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: updateRestaurant is called with lowercase 'superadmin'
    await updateRestaurant(mockReqTypoRole, mockResTypoRole);
    
    // THEN: Should return 403 (strict role checking - case sensitive)
    expect(mockResTypoRole.status).toHaveBeenCalledWith(403);
    expect(mockResTypoRole.json).toHaveBeenCalledWith({
      message: 'Access denied, only Super Admin can update restaurants'
    });
    
    // Verify restaurant still unchanged after case mismatch attempt
    const restaurantStillUnchanged = await Restaurant.findById(testRestaurant._id);
    expect(restaurantStillUnchanged.name).toBe('Original Restaurant Name');
  });

  // Test 5: getRestaurantById() | error | Restaurant not found (404) - null pointer risk mitigation
  test('Test 5: getRestaurantById() should return 404 when restaurant ID not found (null pointer risk mitigation)', async () => {
    // GIVEN: A valid superAdmin user but non-existent restaurant ID
    const mockReq = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin',
        name: 'Valid Super Admin'
      },
      params: {
        id: '507f1f77bcf86cd799439011' // Valid MongoDB ObjectId format but doesn't exist
      }
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: getRestaurantById is called with non-existent restaurant ID
    await getRestaurantById(mockReq, mockRes);
    
    // THEN: Should return 404 with not found message (null pointer risk mitigated - no crash on null)
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Restaurant not found'
    });
    expect(mockRes.status).toHaveBeenCalledTimes(1);
    expect(mockRes.json).toHaveBeenCalledTimes(1);
    
    // GIVEN: Request with invalid MongoDB ObjectId format (will cause exception)
    const mockReqInvalidId = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin',
        name: 'Valid Super Admin'
      },
      params: {
        id: 'invalid-objectid-format' // Invalid format
      }
    };
    
    const mockResInvalidId = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Suppress expected console.error for CastError
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // WHEN: getRestaurantById is called with invalid ObjectId format
    await getRestaurantById(mockReqInvalidId, mockResInvalidId);
    
    // THEN: Should return 500 with server error (handles exception gracefully without crash)
    expect(mockResInvalidId.status).toHaveBeenCalledWith(500);
    expect(mockResInvalidId.json).toHaveBeenCalledWith({
      message: 'Server Error'
    });
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
    
    // GIVEN: Request with null/undefined ID (extreme null pointer case)
    const mockReqNullId = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin',
        name: 'Valid Super Admin'
      },
      params: {
        id: null
      }
    };
    
    const mockResNullId = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Suppress expected console.error
    const consoleErrorSpy2 = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // WHEN: getRestaurantById is called with null ID
    await getRestaurantById(mockReqNullId, mockResNullId);
    
    // THEN: Should handle gracefully without crashing (null pointer protection)
    expect([404, 500]).toContain(mockResNullId.status.mock.calls[0][0]);
    expect(mockResNullId.json).toHaveBeenCalled();
    
    // Restore console.error
    consoleErrorSpy2.mockRestore();
  });

  // Test 6: deleteRestaurant() | error | Restaurant not found before delete (404) - null pointer risk mitigation
  test('Test 6: deleteRestaurant() should return 404 when restaurant not found before delete (null pointer risk mitigation)', async () => {
    // GIVEN: A valid superAdmin user but non-existent restaurant ID
    const mockReq = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin',
        name: 'Valid Super Admin'
      },
      params: {
        id: '507f1f77bcf86cd799439012' // Valid format but doesn't exist
      }
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: deleteRestaurant is called with non-existent restaurant ID
    await deleteRestaurant(mockReq, mockRes);
    
    // THEN: Should return 404 without attempting to delete null (null pointer risk mitigated)
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Restaurant not found'
    });
    
    // Verify no restaurant was deleted (database integrity maintained)
    const totalCount = await Restaurant.countDocuments();
    expect(totalCount).toBe(0);
    
    // GIVEN: Create a restaurant then attempt to delete with different ID
    const existingRestaurant = new Restaurant({
      name: 'Safe Restaurant',
      ownerName: 'Safe Owner',
      location: 'Safe Location',
      contactNumber: '2222222222',
      admin: {
        email: 'safe@restaurant.com',
        password: 'SafePass123!'
      }
    });
    await existingRestaurant.save();
    
    const mockReqWrongId = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin',
        name: 'Valid Super Admin'
      },
      params: {
        id: '507f1f77bcf86cd799439013' // Different non-existent ID
      }
    };
    
    const mockResWrongId = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: deleteRestaurant is called with wrong ID
    await deleteRestaurant(mockReqWrongId, mockResWrongId);
    
    // THEN: Should return 404 without deleting the existing restaurant (precise deletion control)
    expect(mockResWrongId.status).toHaveBeenCalledWith(404);
    expect(mockResWrongId.json).toHaveBeenCalledWith({
      message: 'Restaurant not found'
    });
    
    // Verify existing restaurant was NOT deleted by mistake
    const restaurantStillExists = await Restaurant.findById(existingRestaurant._id);
    expect(restaurantStillExists).toBeDefined();
    expect(restaurantStillExists.name).toBe('Safe Restaurant');
    
    // GIVEN: Request with invalid ObjectId causing exception
    const mockReqInvalidId = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin',
        name: 'Valid Super Admin'
      },
      params: {
        id: 'not-a-valid-objectid'
      }
    };
    
    const mockResInvalidId = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Suppress expected console.error for CastError
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // WHEN: deleteRestaurant is called with invalid ObjectId
    await deleteRestaurant(mockReqInvalidId, mockResInvalidId);
    
    // THEN: Should return 500 and not crash (exception handling)
    expect(mockResInvalidId.status).toHaveBeenCalledWith(500);
    expect(mockResInvalidId.json).toHaveBeenCalledWith({
      message: 'Server Error'
    });
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
    
    // Verify restaurant still exists after exception
    const restaurantStillExistsAfterError = await Restaurant.findById(existingRestaurant._id);
    expect(restaurantStillExistsAfterError).toBeDefined();
  });

  // Test 7: updateRestaurant() | error | Restaurant not found on update (404) - null pointer risk mitigation
  test('Test 7: updateRestaurant() should return 404 when restaurant not found on update (null pointer risk mitigation)', async () => {
    // GIVEN: A valid superAdmin user with update data but non-existent restaurant ID
    const mockReq = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin',
        name: 'Valid Super Admin'
      },
      params: {
        id: '507f1f77bcf86cd799439014' // Valid format but doesn't exist
      },
      body: {
        name: 'Updated Restaurant Name',
        ownerName: 'Updated Owner',
        location: 'Updated Location',
        contactNumber: '3333333333'
      }
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: updateRestaurant is called with non-existent restaurant ID
    await updateRestaurant(mockReq, mockRes);
    
    // THEN: Should return 404 without creating new restaurant (null pointer risk mitigated)
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Restaurant not found'
    });
    
    // Verify no restaurant was created (update doesn't create)
    const totalCount = await Restaurant.countDocuments();
    expect(totalCount).toBe(0);
    
    // GIVEN: Create a restaurant then attempt to update with different ID
    const existingRestaurant = new Restaurant({
      name: 'Original Name',
      ownerName: 'Original Owner',
      location: 'Original Location',
      contactNumber: '4444444444',
      admin: {
        email: 'original@restaurant.com',
        password: 'OriginalPass123!'
      }
    });
    await existingRestaurant.save();
    
    const mockReqWrongId = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin',
        name: 'Valid Super Admin'
      },
      params: {
        id: '507f1f77bcf86cd799439015' // Different non-existent ID
      },
      body: {
        name: 'Wrong Update Name'
      }
    };
    
    const mockResWrongId = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: updateRestaurant is called with wrong ID
    await updateRestaurant(mockReqWrongId, mockResWrongId);
    
    // THEN: Should return 404 without updating the existing restaurant (precise update control)
    expect(mockResWrongId.status).toHaveBeenCalledWith(404);
    expect(mockResWrongId.json).toHaveBeenCalledWith({
      message: 'Restaurant not found'
    });
    
    // Verify existing restaurant was NOT updated by mistake
    const restaurantUnchanged = await Restaurant.findById(existingRestaurant._id);
    expect(restaurantUnchanged).toBeDefined();
    expect(restaurantUnchanged.name).toBe('Original Name');
    expect(restaurantUnchanged.ownerName).toBe('Original Owner');
    
    // GIVEN: Request with null body (null pointer edge case)
    const mockReqNullBody = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin',
        name: 'Valid Super Admin'
      },
      params: {
        id: '507f1f77bcf86cd799439016'
      },
      body: null // Null body
    };
    
    const mockResNullBody = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: updateRestaurant is called with null body
    await updateRestaurant(mockReqNullBody, mockResNullBody);
    
    // THEN: Should return 404 or 500 (handles null body gracefully)
    expect([404, 500]).toContain(mockResNullBody.status.mock.calls[0][0]);
    expect(mockResNullBody.json).toHaveBeenCalled();
    
    // GIVEN: Request with invalid ObjectId format
    const mockReqInvalidId = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin',
        name: 'Valid Super Admin'
      },
      params: {
        id: 'invalid-format'
      },
      body: {
        name: 'Should Not Update'
      }
    };
    
    const mockResInvalidId = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Suppress expected console.error for CastError
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // WHEN: updateRestaurant is called with invalid ObjectId
    await updateRestaurant(mockReqInvalidId, mockResInvalidId);
    
    // THEN: Should return error without crashing (exception handling)
    expect([404, 500]).toContain(mockResInvalidId.status.mock.calls[0][0]);
    expect(mockResInvalidId.json).toHaveBeenCalled();
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
    
    // Verify existing restaurant still unchanged after all failed attempts
    const restaurantStillUnchanged = await Restaurant.findById(existingRestaurant._id);
    expect(restaurantStillUnchanged.name).toBe('Original Name');
  });

  // Test 8: getAllRestaurants() | happy | Successful retrieval with superAdmin role
  test('Test 8: getAllRestaurants() should return all restaurants when user is superAdmin (validates core functionality)', async () => {
    // GIVEN: Multiple restaurants exist in database
    const restaurant1 = new Restaurant({
      name: 'Restaurant One',
      ownerName: 'Owner One',
      location: 'Location One',
      contactNumber: '1111111111',
      admin: {
        email: 'restaurant1@test.com',
        password: 'Pass123!'
      }
    });
    
    const restaurant2 = new Restaurant({
      name: 'Restaurant Two',
      ownerName: 'Owner Two',
      location: 'Location Two',
      contactNumber: '2222222222',
      admin: {
        email: 'restaurant2@test.com',
        password: 'Pass123!'
      }
    });
    
    const restaurant3 = new Restaurant({
      name: 'Restaurant Three',
      ownerName: 'Owner Three',
      location: 'Location Three',
      contactNumber: '3333333333',
      admin: {
        email: 'restaurant3@test.com',
        password: 'Pass123!'
      }
    });
    
    await restaurant1.save();
    await restaurant2.save();
    await restaurant3.save();
    
    // AND: A valid superAdmin user request
    const mockReq = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin', // Correct role
        name: 'Valid Super Admin'
      }
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: getAllRestaurants is called with superAdmin user
    await getAllRestaurants(mockReq, mockRes);
    
    // THEN: Should return 200 with all restaurants (core functionality validated)
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledTimes(1);
    
    const returnedRestaurants = mockRes.json.mock.calls[0][0];
    expect(Array.isArray(returnedRestaurants)).toBe(true);
    expect(returnedRestaurants.length).toBe(3);
    
    // Verify all restaurants are returned with correct data
    const restaurantNames = returnedRestaurants.map(r => r.name);
    expect(restaurantNames).toContain('Restaurant One');
    expect(restaurantNames).toContain('Restaurant Two');
    expect(restaurantNames).toContain('Restaurant Three');
    
    const restaurantOwners = returnedRestaurants.map(r => r.ownerName);
    expect(restaurantOwners).toContain('Owner One');
    expect(restaurantOwners).toContain('Owner Two');
    expect(restaurantOwners).toContain('Owner Three');
    
    // Verify restaurant objects have expected properties
    returnedRestaurants.forEach(restaurant => {
      expect(restaurant).toHaveProperty('_id');
      expect(restaurant).toHaveProperty('name');
      expect(restaurant).toHaveProperty('ownerName');
      expect(restaurant).toHaveProperty('location');
      expect(restaurant).toHaveProperty('contactNumber');
      expect(restaurant).toHaveProperty('admin');
    });
    
    // GIVEN: Empty database scenario (edge case - no restaurants)
    await Restaurant.deleteMany({});
    
    const mockReqEmpty = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin',
        name: 'Valid Super Admin'
      }
    };
    
    const mockResEmpty = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: getAllRestaurants is called with no restaurants in database
    await getAllRestaurants(mockReqEmpty, mockResEmpty);
    
    // THEN: Should return 200 with empty array (handles empty result gracefully)
    expect(mockResEmpty.status).toHaveBeenCalledWith(200);
    const emptyResult = mockResEmpty.json.mock.calls[0][0];
    expect(Array.isArray(emptyResult)).toBe(true);
    expect(emptyResult.length).toBe(0);
    
    // GIVEN: Large number of restaurants (performance edge case)
    const manyRestaurants = [];
    for (let i = 1; i <= 50; i++) {
      manyRestaurants.push(new Restaurant({
        name: `Restaurant ${i}`,
        ownerName: `Owner ${i}`,
        location: `Location ${i}`,
        contactNumber: `${i.toString().padStart(10, '0')}`,
        admin: {
          email: `restaurant${i}@test.com`,
          password: 'Pass123!'
        }
      }));
    }
    await Restaurant.insertMany(manyRestaurants);
    
    const mockReqMany = {
      user: {
        id: 'superadmin123',
        role: 'superAdmin',
        name: 'Valid Super Admin'
      }
    };
    
    const mockResMany = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // WHEN: getAllRestaurants is called with many restaurants
    await getAllRestaurants(mockReqMany, mockResMany);
    
    // THEN: Should return 200 with all 50 restaurants (handles large datasets)
    expect(mockResMany.status).toHaveBeenCalledWith(200);
    const manyResults = mockResMany.json.mock.calls[0][0];
    expect(Array.isArray(manyResults)).toBe(true);
    expect(manyResults.length).toBe(50);
  });
});

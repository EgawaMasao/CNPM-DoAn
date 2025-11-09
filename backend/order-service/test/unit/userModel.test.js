import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "../../models/userModel.js";

let mongoServer;

beforeAll(async () => {
    // GIVEN: In-memory MongoDB server for isolated testing
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

afterAll(async () => {
    // Clean up database connection and server
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    // Clean up collections after each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

describe("User Model Unit Tests", () => {
    describe("Test 1: User.create() - Happy Path - Verify model creates valid user with all required fields", () => {
        it("should create a valid user with all required fields (name, email, password, role)", async () => {
            // GIVEN: Valid user data with all required fields
            const validUserData = {
                name: "John Doe",
                email: "john.doe@example.com",
                password: "securePassword123",
                role: "customer"
            };

            // WHEN: Creating a new user
            const user = await User.create(validUserData);

            // THEN: User should be created successfully with all fields
            expect(user).toBeDefined();
            expect(user._id).toBeDefined();
            expect(user.name).toBe(validUserData.name);
            expect(user.email).toBe(validUserData.email);
            expect(user.password).toBe(validUserData.password);
            expect(user.role).toBe(validUserData.role);
            expect(user.createdAt).toBeDefined();
            expect(user.updatedAt).toBeDefined();
        });

        it("should create a valid user with default role when role is not specified", async () => {
            // GIVEN: Valid user data without role field
            const validUserData = {
                name: "Jane Smith",
                email: "jane.smith@example.com",
                password: "anotherSecurePass456"
            };

            // WHEN: Creating a new user without specifying role
            const user = await User.create(validUserData);

            // THEN: User should be created with default role "customer"
            expect(user).toBeDefined();
            expect(user.role).toBe("customer");
            expect(user.name).toBe(validUserData.name);
            expect(user.email).toBe(validUserData.email);
        });
    });

    describe("Test 2: User.create() - Error Path - Verify validation fails when required field 'name' is missing", () => {
        it("should throw validation error when name is missing", async () => {
            // GIVEN: User data without required 'name' field
            const invalidUserData = {
                email: "test@example.com",
                password: "password123"
            };

            // WHEN: Attempting to create user without name
            // THEN: Should throw validation error
            await expect(User.create(invalidUserData)).rejects.toThrow(mongoose.Error.ValidationError);
            await expect(User.create(invalidUserData)).rejects.toThrow(/name/);
        });

        it("should throw validation error when name is null", async () => {
            // GIVEN: User data with null name
            const invalidUserData = {
                name: null,
                email: "test@example.com",
                password: "password123"
            };

            // WHEN: Attempting to create user with null name
            // THEN: Should throw validation error
            await expect(User.create(invalidUserData)).rejects.toThrow();
        });

        it("should throw validation error when name is empty string", async () => {
            // GIVEN: User data with empty name
            const invalidUserData = {
                name: "",
                email: "test@example.com",
                password: "password123"
            };

            // WHEN: Attempting to create user with empty name
            // THEN: Should throw validation error
            await expect(User.create(invalidUserData)).rejects.toThrow();
        });
    });

    describe("Test 3: User.create() - Error Path - Verify validation fails when required field 'email' is missing", () => {
        it("should throw validation error when email is missing", async () => {
            // GIVEN: User data without required 'email' field
            const invalidUserData = {
                name: "John Doe",
                password: "password123"
            };

            // WHEN: Attempting to create user without email
            // THEN: Should throw validation error
            await expect(User.create(invalidUserData)).rejects.toThrow(mongoose.Error.ValidationError);
            await expect(User.create(invalidUserData)).rejects.toThrow(/email/);
        });

        it("should throw validation error when email is null", async () => {
            // GIVEN: User data with null email
            const invalidUserData = {
                name: "John Doe",
                email: null,
                password: "password123"
            };

            // WHEN: Attempting to create user with null email
            // THEN: Should throw validation error
            await expect(User.create(invalidUserData)).rejects.toThrow();
        });

        it("should throw validation error when email is empty string", async () => {
            // GIVEN: User data with empty email
            const invalidUserData = {
                name: "John Doe",
                email: "",
                password: "password123"
            };

            // WHEN: Attempting to create user with empty email
            // THEN: Should throw validation error
            await expect(User.create(invalidUserData)).rejects.toThrow();
        });
    });

    describe("Test 4: User.create() - Error Path - Verify validation fails when required field 'password' is missing", () => {
        it("should throw validation error when password is missing", async () => {
            // GIVEN: User data without required 'password' field
            const invalidUserData = {
                name: "John Doe",
                email: "john@example.com"
            };

            // WHEN: Attempting to create user without password
            // THEN: Should throw validation error
            await expect(User.create(invalidUserData)).rejects.toThrow(mongoose.Error.ValidationError);
            await expect(User.create(invalidUserData)).rejects.toThrow(/password/);
        });

        it("should throw validation error when password is null", async () => {
            // GIVEN: User data with null password
            const invalidUserData = {
                name: "John Doe",
                email: "john@example.com",
                password: null
            };

            // WHEN: Attempting to create user with null password
            // THEN: Should throw validation error
            await expect(User.create(invalidUserData)).rejects.toThrow();
        });

        it("should throw validation error when password is empty string", async () => {
            // GIVEN: User data with empty password
            const invalidUserData = {
                name: "John Doe",
                email: "john@example.com",
                password: ""
            };

            // WHEN: Attempting to create user with empty password
            // THEN: Should throw validation error
            await expect(User.create(invalidUserData)).rejects.toThrow();
        });
    });

    describe("Test 5: User.create() - Edge Case - Verify unique constraint on email prevents duplicate user creation", () => {
        it("should throw duplicate key error when creating user with existing email", async () => {
            // GIVEN: A user already exists with a specific email
            const userData = {
                name: "John Doe",
                email: "duplicate@example.com",
                password: "password123"
            };
            await User.create(userData);

            // WHEN: Attempting to create another user with the same email
            const duplicateUserData = {
                name: "Jane Doe",
                email: "duplicate@example.com",
                password: "differentPassword456"
            };

            // THEN: Should throw duplicate key error (MongoServerError code 11000)
            await expect(User.create(duplicateUserData)).rejects.toThrow();
            await expect(User.create(duplicateUserData)).rejects.toMatchObject({
                code: 11000
            });
        });

        it("should allow creating users with same name but different emails", async () => {
            // GIVEN: Two users with same name but different emails
            const user1Data = {
                name: "John Smith",
                email: "john.smith1@example.com",
                password: "password123"
            };
            const user2Data = {
                name: "John Smith",
                email: "john.smith2@example.com",
                password: "password456"
            };

            // WHEN: Creating both users
            const user1 = await User.create(user1Data);
            const user2 = await User.create(user2Data);

            // THEN: Both users should be created successfully
            expect(user1).toBeDefined();
            expect(user2).toBeDefined();
            expect(user1.email).not.toBe(user2.email);
            expect(user1.name).toBe(user2.name);
        });

        it("should throw error for duplicate email with case sensitivity", async () => {
            // GIVEN: A user already exists
            const userData = {
                name: "John Doe",
                email: "test@example.com",
                password: "password123"
            };
            await User.create(userData);

            // WHEN: Attempting to create user with exact same email
            const duplicateUserData = {
                name: "Different Name",
                email: "test@example.com",
                password: "differentPassword"
            };

            // THEN: Should throw duplicate key error
            await expect(User.create(duplicateUserData)).rejects.toThrow();
        });
    });
});

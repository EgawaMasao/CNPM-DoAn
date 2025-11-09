import { jest } from "@jest/globals";

// Create mock functions
const mockGenSalt = jest.fn();
const mockHash = jest.fn();
const mockCompare = jest.fn();
const mockSign = jest.fn();
const mockFindOne = jest.fn();
const mockCreate = jest.fn();

// Mock bcryptjs
jest.unstable_mockModule("bcryptjs", () => ({
    default: {
        genSalt: mockGenSalt,
        hash: mockHash,
        compare: mockCompare,
    },
    genSalt: mockGenSalt,
    hash: mockHash,
    compare: mockCompare,
}));

// Mock jsonwebtoken
jest.unstable_mockModule("jsonwebtoken", () => ({
    default: {
        sign: mockSign,
    },
    sign: mockSign,
}));

// Mock User model
jest.unstable_mockModule("../../models/userModel.js", () => ({
    default: {
        findOne: mockFindOne,
        create: mockCreate,
    },
}));

// Import after mocking
const { registerUser, loginUser } = await import("../../controllers/userController.js");

describe("userController", () => {
    let req, res;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Setup request and response mocks
        req = {
            body: {},
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        // Set up environment variable
        process.env.JWT_SECRET = "test-secret-key";
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    // Test 1: registerUser - Happy path
    describe("registerUser - Happy Path", () => {
        it("should successfully register a new user with valid data and return token", async () => {
            // GIVEN: Valid user registration data
            req.body = {
                name: "John Doe",
                email: "john@example.com",
                password: "password123",
                role: "customer",
            };

            const mockUser = {
                _id: "user123",
                name: "John Doe",
                email: "john@example.com",
                password: "hashedPassword",
                role: "customer",
            };

            const mockToken = "mock.jwt.token";

            // Mock User.findOne to return null (user doesn't exist)
            mockFindOne.mockResolvedValue(null);

            // Mock bcrypt.genSalt and bcrypt.hash
            mockGenSalt.mockResolvedValue("salt");
            mockHash.mockResolvedValue("hashedPassword");

            // Mock User.create to return the new user
            mockCreate.mockResolvedValue(mockUser);

            // Mock jwt.sign to return a token
            mockSign.mockReturnValue(mockToken);

            // WHEN: registerUser is called
            await registerUser(req, res);

            // THEN: User should be created successfully
            expect(mockFindOne).toHaveBeenCalledWith({ email: "john@example.com" });
            expect(mockGenSalt).toHaveBeenCalledWith(10);
            expect(mockHash).toHaveBeenCalledWith("password123", "salt");
            expect(mockCreate).toHaveBeenCalledWith({
                name: "John Doe",
                email: "john@example.com",
                password: "hashedPassword",
                role: "customer",
            });

            // THEN: JWT token should be generated with correct payload
            expect(mockSign).toHaveBeenCalledWith(
                {
                    id: "user123",
                    role: "customer",
                },
                "test-secret-key",
                { expiresIn: "30d" }
            );

            // THEN: Response should be 201 with success message and token
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                message: "User registered successfully!",
                token: mockToken,
            });
        });

        it("should register user with default role 'customer' when role is not provided", async () => {
            // GIVEN: Registration data without role
            req.body = {
                name: "Jane Doe",
                email: "jane@example.com",
                password: "password456",
            };

            const mockUser = {
                _id: "user456",
                name: "Jane Doe",
                email: "jane@example.com",
                password: "hashedPassword",
                role: "customer",
            };

            mockFindOne.mockResolvedValue(null);
            mockGenSalt.mockResolvedValue("salt");
            mockHash.mockResolvedValue("hashedPassword");
            mockCreate.mockResolvedValue(mockUser);
            mockSign.mockReturnValue("mock.jwt.token");

            // WHEN: registerUser is called
            await registerUser(req, res);

            // THEN: User should be created with default role 'customer'
            expect(mockCreate).toHaveBeenCalledWith({
                name: "Jane Doe",
                email: "jane@example.com",
                password: "hashedPassword",
                role: "customer",
            });

            expect(res.status).toHaveBeenCalledWith(201);
        });

        it("should handle null or undefined inputs gracefully", async () => {
            // GIVEN: Request with null/undefined values
            req.body = {
                name: null,
                email: undefined,
                password: "test123",
            };

            mockFindOne.mockResolvedValue(null);
            mockGenSalt.mockResolvedValue("salt");
            mockHash.mockResolvedValue("hashedPassword");
            mockCreate.mockResolvedValue(null);

            // WHEN: registerUser is called
            await registerUser(req, res);

            // THEN: Should return 400 for invalid user data
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: "Invalid user data" });
        });
    });

    // Test 2: loginUser - Happy path
    describe("loginUser - Happy Path", () => {
        it("should successfully authenticate user with valid credentials and return token", async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: "john@example.com",
                password: "password123",
            };

            const mockUser = {
                _id: "user123",
                name: "John Doe",
                email: "john@example.com",
                password: "hashedPassword",
                role: "customer",
            };

            const mockToken = "mock.jwt.token";

            // Mock User.findOne to return existing user
            mockFindOne.mockResolvedValue(mockUser);

            // Mock bcrypt.compare to return true (password matches)
            mockCompare.mockResolvedValue(true);

            // Mock jwt.sign to return a token
            mockSign.mockReturnValue(mockToken);

            // WHEN: loginUser is called
            await loginUser(req, res);

            // THEN: User should be found and password verified
            expect(mockFindOne).toHaveBeenCalledWith({ email: "john@example.com" });
            expect(mockCompare).toHaveBeenCalledWith("password123", "hashedPassword");

            // THEN: JWT token should be generated with correct payload
            expect(mockSign).toHaveBeenCalledWith(
                {
                    id: "user123",
                    role: "customer",
                },
                "test-secret-key",
                { expiresIn: "30d" }
            );

            // THEN: Response should contain user data and token
            expect(res.json).toHaveBeenCalledWith({
                _id: "user123",
                name: "John Doe",
                email: "john@example.com",
                role: "customer",
                token: mockToken,
            });

            expect(res.status).not.toHaveBeenCalled();
        });

        it("should handle null password input", async () => {
            // GIVEN: Login request with null password
            req.body = {
                email: "john@example.com",
                password: null,
            };

            const mockUser = {
                _id: "user123",
                email: "john@example.com",
                password: "hashedPassword",
            };

            mockFindOne.mockResolvedValue(mockUser);
            mockCompare.mockResolvedValue(false);

            // WHEN: loginUser is called
            await loginUser(req, res);

            // THEN: Should return 401 for invalid credentials
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: "Invalid email or password" });
        });
    });

    // Test 3: registerUser - Error: User already exists
    describe("registerUser - Error: User Already Exists", () => {
        it("should return 400 error when user with email already exists", async () => {
            // GIVEN: Registration data with existing email
            req.body = {
                name: "John Doe",
                email: "existing@example.com",
                password: "password123",
                role: "customer",
            };

            const existingUser = {
                _id: "existingUser123",
                name: "Existing User",
                email: "existing@example.com",
                password: "hashedPassword",
                role: "customer",
            };

            // Mock User.findOne to return existing user
            mockFindOne.mockResolvedValue(existingUser);

            // WHEN: registerUser is called
            await registerUser(req, res);

            // THEN: Should check if user exists
            expect(mockFindOne).toHaveBeenCalledWith({ email: "existing@example.com" });

            // THEN: Should not attempt to create user or hash password
            expect(mockGenSalt).not.toHaveBeenCalled();
            expect(mockHash).not.toHaveBeenCalled();
            expect(mockCreate).not.toHaveBeenCalled();

            // THEN: Should return 400 error with appropriate message
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: "User already exists" });
        });

        it("should handle database exception when checking for existing user", async () => {
            // GIVEN: Registration data
            req.body = {
                name: "John Doe",
                email: "john@example.com",
                password: "password123",
            };

            // Mock User.findOne to throw database error
            mockFindOne.mockRejectedValue(new Error("Database connection failed"));

            // WHEN: registerUser is called
            await registerUser(req, res);

            // THEN: Should return 500 server error
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: "Server error" });
        });

        it("should handle exception during user creation", async () => {
            // GIVEN: Valid registration data
            req.body = {
                name: "John Doe",
                email: "john@example.com",
                password: "password123",
            };

            mockFindOne.mockResolvedValue(null);
            mockGenSalt.mockResolvedValue("salt");
            mockHash.mockResolvedValue("hashedPassword");

            // Mock User.create to throw error
            mockCreate.mockRejectedValue(new Error("Database write failed"));

            // WHEN: registerUser is called
            await registerUser(req, res);

            // THEN: Should return 500 server error
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: "Server error" });
        });
    });

    // Test 4: loginUser - Error: Invalid credentials
    describe("loginUser - Error: Invalid Credentials", () => {
        it("should return 401 error when password is incorrect", async () => {
            // GIVEN: Login credentials with wrong password
            req.body = {
                email: "john@example.com",
                password: "wrongpassword",
            };

            const mockUser = {
                _id: "user123",
                name: "John Doe",
                email: "john@example.com",
                password: "hashedPassword",
                role: "customer",
            };

            // Mock User.findOne to return existing user
            mockFindOne.mockResolvedValue(mockUser);

            // Mock bcrypt.compare to return false (password doesn't match)
            mockCompare.mockResolvedValue(false);

            // WHEN: loginUser is called
            await loginUser(req, res);

            // THEN: Should find user and verify password
            expect(mockFindOne).toHaveBeenCalledWith({ email: "john@example.com" });
            expect(mockCompare).toHaveBeenCalledWith("wrongpassword", "hashedPassword");

            // THEN: Should not generate token
            expect(mockSign).not.toHaveBeenCalled();

            // THEN: Should return 401 error with invalid credentials message
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: "Invalid email or password" });
        });

        it("should return 401 error when user does not exist", async () => {
            // GIVEN: Login credentials for non-existent user
            req.body = {
                email: "nonexistent@example.com",
                password: "password123",
            };

            // Mock User.findOne to return null (user not found)
            mockFindOne.mockResolvedValue(null);

            // WHEN: loginUser is called
            await loginUser(req, res);

            // THEN: Should attempt to find user
            expect(mockFindOne).toHaveBeenCalledWith({ email: "nonexistent@example.com" });

            // THEN: Should not attempt password comparison or token generation
            expect(mockCompare).not.toHaveBeenCalled();
            expect(mockSign).not.toHaveBeenCalled();

            // THEN: Should return 401 error
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: "Invalid email or password" });
        });

        it("should handle database exception during login", async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: "john@example.com",
                password: "password123",
            };

            // Mock User.findOne to throw database error
            mockFindOne.mockRejectedValue(new Error("Database connection timeout"));

            // WHEN: loginUser is called
            await loginUser(req, res);

            // THEN: Should return 500 server error
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: "Server error" });
        });

        it("should handle bcrypt comparison exception", async () => {
            // GIVEN: Valid login credentials
            req.body = {
                email: "john@example.com",
                password: "password123",
            };

            const mockUser = {
                _id: "user123",
                email: "john@example.com",
                password: "hashedPassword",
            };

            mockFindOne.mockResolvedValue(mockUser);

            // Mock bcrypt.compare to throw error
            mockCompare.mockRejectedValue(new Error("Bcrypt error"));

            // WHEN: loginUser is called
            await loginUser(req, res);

            // THEN: Should return 500 server error
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: "Server error" });
        });
    });
});

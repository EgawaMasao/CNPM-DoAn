// backend/auth-service/controllers/restaurantAdminController.js

const jwt = require("jsonwebtoken");
const RestaurantAdmin = require("../models/RestaurantAdmin");

// Helper to sign a JWT for a given user ID (and role)
const signToken = (userId) => {
  return jwt.sign(
    { id: userId, role: "restaurant-admin" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// @desc    Register a new restaurant admin
// @route   POST /api/auth/register/restaurant-admin
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password, businessLicense } = req.body;

    // 1) Check all required fields
    if (!firstName || !lastName || !email || !phone || !password || !businessLicense) {
      return res.status(400).json({ message: "Please provide all required fields." });
    }

    // 2) Prevent duplicate emails
    const existing = await RestaurantAdmin.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    // 3) Check for duplicate business license
    const existingLicense = await RestaurantAdmin.findOne({ businessLicense });
    if (existingLicense) {
      return res.status(409).json({ message: "Business license already registered." });
    }

    // 4) Create and save the restaurant admin
    const newRestaurantAdmin = await RestaurantAdmin.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      businessLicense,
    });

    // 5) Sign JWT
    const token = signToken(newRestaurantAdmin._id);

    // 6) Respond
    res.status(201).json({
      status: "success",
      token,
      data: {
        restaurantAdmin: {
          id: newRestaurantAdmin._id,
          firstName: newRestaurantAdmin.firstName,
          lastName: newRestaurantAdmin.lastName,
          email: newRestaurantAdmin.email,
          phone: newRestaurantAdmin.phone,
          businessLicense: newRestaurantAdmin.businessLicense,
          isApproved: newRestaurantAdmin.isApproved,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Restaurant admin login
// @route   POST /api/auth/login/restaurant-admin
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check email & password
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // 2) Find restaurant admin & select password explicitly
    const restaurantAdmin = await RestaurantAdmin.findOne({ email }).select("+password");
    if (!restaurantAdmin) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 3) Check if account is approved
    if (!restaurantAdmin.isApproved) {
      return res.status(403).json({ message: "Account is pending approval by an administrator." });
    }

    // 4) Check password
    const valid = await restaurantAdmin.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 5) Generate token
    const token = signToken(restaurantAdmin._id);

    // 6) Respond
    res.json({
      status: "success",
      token,
      data: {
        restaurantAdmin: {
          id: restaurantAdmin._id,
          firstName: restaurantAdmin.firstName,
          lastName: restaurantAdmin.lastName,
          email: restaurantAdmin.email,
          phone: restaurantAdmin.phone,
          businessLicense: restaurantAdmin.businessLicense,
          restaurantId: restaurantAdmin.restaurantId,
          isApproved: restaurantAdmin.isApproved,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get restaurant admin profile
// @route   GET /api/auth/restaurant-admin/me
// @access  Private (Restaurant Admin only)
exports.getMe = async (req, res, next) => {
  try {
    const restaurantAdmin = await RestaurantAdmin.findById(req.user.id).populate('restaurantId');
    if (!restaurantAdmin) {
      return res.status(404).json({ message: "Restaurant admin not found." });
    }

    res.json({
      status: "success",
      data: {
        restaurantAdmin: {
          id: restaurantAdmin._id,
          firstName: restaurantAdmin.firstName,
          lastName: restaurantAdmin.lastName,
          email: restaurantAdmin.email,
          phone: restaurantAdmin.phone,
          businessLicense: restaurantAdmin.businessLicense,
          restaurantId: restaurantAdmin.restaurantId,
          isApproved: restaurantAdmin.isApproved,
          approvedAt: restaurantAdmin.approvedAt,
          createdAt: restaurantAdmin.createdAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update restaurant admin profile
// @route   PATCH /api/auth/restaurant-admin/me
// @access  Private (Restaurant Admin only)
exports.updateMe = async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const updatedRestaurantAdmin = await RestaurantAdmin.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, phone },
      { new: true, runValidators: true }
    );

    if (!updatedRestaurantAdmin) {
      return res.status(404).json({ message: "Restaurant admin not found." });
    }

    res.json({
      status: "success",
      data: {
        restaurantAdmin: {
          id: updatedRestaurantAdmin._id,
          firstName: updatedRestaurantAdmin.firstName,
          lastName: updatedRestaurantAdmin.lastName,
          email: updatedRestaurantAdmin.email,
          phone: updatedRestaurantAdmin.phone,
          businessLicense: updatedRestaurantAdmin.businessLicense,
          restaurantId: updatedRestaurantAdmin.restaurantId,
          isApproved: updatedRestaurantAdmin.isApproved,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Approve restaurant admin (Admin only)
// @route   PATCH /api/auth/restaurant-admin/:id/approve
// @access  Private (Admin only)
exports.approveRestaurantAdmin = async (req, res, next) => {
  try {
    const restaurantAdmin = await RestaurantAdmin.findByIdAndUpdate(
      req.params.id,
      {
        isApproved: true,
        approvedBy: req.user.id,
        approvedAt: new Date(),
      },
      { new: true }
    );

    if (!restaurantAdmin) {
      return res.status(404).json({ message: "Restaurant admin not found." });
    }

    res.json({
      status: "success",
      data: {
        restaurantAdmin: {
          id: restaurantAdmin._id,
          firstName: restaurantAdmin.firstName,
          lastName: restaurantAdmin.lastName,
          email: restaurantAdmin.email,
          isApproved: restaurantAdmin.isApproved,
          approvedAt: restaurantAdmin.approvedAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all pending restaurant admins (Admin only)
// @route   GET /api/auth/restaurant-admin/pending
// @access  Private (Admin only)
exports.getPendingRestaurantAdmins = async (req, res, next) => {
  try {
    const pendingAdmins = await RestaurantAdmin.find({ isApproved: false });

    res.json({
      status: "success",
      results: pendingAdmins.length,
      data: {
        restaurantAdmins: pendingAdmins.map(admin => ({
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phone: admin.phone,
          businessLicense: admin.businessLicense,
          createdAt: admin.createdAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// backend/auth-service/controllers/adminController.js

const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

// Helper to sign a JWT for a given user ID (and role)
const signToken = (userId) => {
  return jwt.sign(
    { id: userId, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// @desc    Register a new admin
// @route   POST /api/auth/register/admin
// @access  Public (or should be restricted in production)
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password, role, permissions } = req.body;

    // 1) Check all required fields
    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({ message: "Please provide all required fields." });
    }

    // 2) Prevent duplicate emails
    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    // 3) Create and save the admin
    const newAdmin = await Admin.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      role: role || "admin",
      permissions: permissions || ["manage-users", "manage-restaurants", "manage-orders"],
    });

    // 4) Sign JWT
    const token = signToken(newAdmin._id);

    // 5) Respond
    res.status(201).json({
      status: "success",
      token,
      data: {
        admin: {
          id: newAdmin._id,
          firstName: newAdmin.firstName,
          lastName: newAdmin.lastName,
          email: newAdmin.email,
          phone: newAdmin.phone,
          role: newAdmin.role,
          permissions: newAdmin.permissions,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin login
// @route   POST /api/auth/login/admin
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check email & password
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // 2) Find admin & select password explicitly
    const admin = await Admin.findOne({ email }).select("+password");
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 3) Check password
    const valid = await admin.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 4) Generate token
    const token = signToken(admin._id);

    // 5) Respond
    res.json({
      status: "success",
      token,
      data: {
        admin: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
          permissions: admin.permissions,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get admin profile
// @route   GET /api/auth/admin/me
// @access  Private (Admin only)
exports.getMe = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    res.json({
      status: "success",
      data: {
        admin: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
          permissions: admin.permissions,
          createdAt: admin.createdAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update admin profile
// @route   PATCH /api/auth/admin/me
// @access  Private (Admin only)
exports.updateMe = async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const updatedAdmin = await Admin.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, phone },
      { new: true, runValidators: true }
    );

    if (!updatedAdmin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    res.json({
      status: "success",
      data: {
        admin: {
          id: updatedAdmin._id,
          firstName: updatedAdmin.firstName,
          lastName: updatedAdmin.lastName,
          email: updatedAdmin.email,
          phone: updatedAdmin.phone,
          role: updatedAdmin.role,
          permissions: updatedAdmin.permissions,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

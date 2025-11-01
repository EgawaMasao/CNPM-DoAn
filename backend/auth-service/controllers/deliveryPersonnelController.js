// backend/auth-service/controllers/deliveryPersonnelController.js

const jwt = require("jsonwebtoken");
const DeliveryPersonnel = require("../models/DeliveryPersonnel");

// Helper to sign a JWT for a given user ID (and role)
const signToken = (userId) => {
  return jwt.sign(
    { id: userId, role: "delivery" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// @desc    Register a new delivery personnel
// @route   POST /api/auth/register/delivery
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password, vehicleType, licenseNumber } = req.body;

    // 1) Check all required fields
    if (!firstName || !lastName || !email || !phone || !password || !vehicleType || !licenseNumber) {
      return res.status(400).json({ message: "Please provide all required fields." });
    }

    // 2) Prevent duplicate emails
    const existing = await DeliveryPersonnel.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    // 3) Check for duplicate license number
    const existingLicense = await DeliveryPersonnel.findOne({ licenseNumber });
    if (existingLicense) {
      return res.status(409).json({ message: "License number already registered." });
    }

    // 4) Create and save the delivery personnel
    const newDeliveryPersonnel = await DeliveryPersonnel.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      vehicleType,
      licenseNumber,
    });

    // 5) Sign JWT
    const token = signToken(newDeliveryPersonnel._id);

    // 6) Respond
    res.status(201).json({
      status: "success",
      token,
      data: {
        deliveryPersonnel: {
          id: newDeliveryPersonnel._id,
          firstName: newDeliveryPersonnel.firstName,
          lastName: newDeliveryPersonnel.lastName,
          email: newDeliveryPersonnel.email,
          phone: newDeliveryPersonnel.phone,
          vehicleType: newDeliveryPersonnel.vehicleType,
          licenseNumber: newDeliveryPersonnel.licenseNumber,
          isAvailable: newDeliveryPersonnel.isAvailable,
          rating: newDeliveryPersonnel.rating,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delivery personnel login
// @route   POST /api/auth/login/delivery
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check email & password
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // 2) Find delivery personnel & select password explicitly
    const deliveryPersonnel = await DeliveryPersonnel.findOne({ email }).select("+password");
    if (!deliveryPersonnel) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 3) Check password
    const valid = await deliveryPersonnel.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 4) Generate token
    const token = signToken(deliveryPersonnel._id);

    // 5) Respond
    res.json({
      status: "success",
      token,
      data: {
        deliveryPersonnel: {
          id: deliveryPersonnel._id,
          firstName: deliveryPersonnel.firstName,
          lastName: deliveryPersonnel.lastName,
          email: deliveryPersonnel.email,
          phone: deliveryPersonnel.phone,
          vehicleType: deliveryPersonnel.vehicleType,
          licenseNumber: deliveryPersonnel.licenseNumber,
          isAvailable: deliveryPersonnel.isAvailable,
          rating: deliveryPersonnel.rating,
          totalDeliveries: deliveryPersonnel.totalDeliveries,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get delivery personnel profile
// @route   GET /api/auth/delivery/me
// @access  Private (Delivery only)
exports.getMe = async (req, res, next) => {
  try {
    const deliveryPersonnel = await DeliveryPersonnel.findById(req.user.id);
    if (!deliveryPersonnel) {
      return res.status(404).json({ message: "Delivery personnel not found." });
    }

    res.json({
      status: "success",
      data: {
        deliveryPersonnel: {
          id: deliveryPersonnel._id,
          firstName: deliveryPersonnel.firstName,
          lastName: deliveryPersonnel.lastName,
          email: deliveryPersonnel.email,
          phone: deliveryPersonnel.phone,
          vehicleType: deliveryPersonnel.vehicleType,
          licenseNumber: deliveryPersonnel.licenseNumber,
          currentLocation: deliveryPersonnel.currentLocation,
          isAvailable: deliveryPersonnel.isAvailable,
          rating: deliveryPersonnel.rating,
          totalDeliveries: deliveryPersonnel.totalDeliveries,
          createdAt: deliveryPersonnel.createdAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update delivery personnel profile
// @route   PATCH /api/auth/delivery/me
// @access  Private (Delivery only)
exports.updateMe = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, isAvailable } = req.body;

    const updatedDeliveryPersonnel = await DeliveryPersonnel.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, phone, isAvailable },
      { new: true, runValidators: true }
    );

    if (!updatedDeliveryPersonnel) {
      return res.status(404).json({ message: "Delivery personnel not found." });
    }

    res.json({
      status: "success",
      data: {
        deliveryPersonnel: {
          id: updatedDeliveryPersonnel._id,
          firstName: updatedDeliveryPersonnel.firstName,
          lastName: updatedDeliveryPersonnel.lastName,
          email: updatedDeliveryPersonnel.email,
          phone: updatedDeliveryPersonnel.phone,
          vehicleType: updatedDeliveryPersonnel.vehicleType,
          isAvailable: updatedDeliveryPersonnel.isAvailable,
          rating: updatedDeliveryPersonnel.rating,
          totalDeliveries: updatedDeliveryPersonnel.totalDeliveries,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update delivery personnel location
// @route   PATCH /api/auth/delivery/location
// @access  Private (Delivery only)
exports.updateLocation = async (req, res, next) => {
  try {
    const { longitude, latitude } = req.body;

    if (!longitude || !latitude) {
      return res.status(400).json({ message: "Longitude and latitude are required." });
    }

    const updatedDeliveryPersonnel = await DeliveryPersonnel.findByIdAndUpdate(
      req.user.id,
      {
        currentLocation: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
      },
      { new: true }
    );

    if (!updatedDeliveryPersonnel) {
      return res.status(404).json({ message: "Delivery personnel not found." });
    }

    res.json({
      status: "success",
      data: {
        currentLocation: updatedDeliveryPersonnel.currentLocation,
      },
    });
  } catch (err) {
    next(err);
  }
};

// backend/auth-service/models/DeliveryPersonnel.js
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const deliveryPersonnelSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  vehicleType: {
    type: String,
    required: true,
    enum: ["bike", "scooter", "car", "bicycle"],
  },
  licenseNumber: {
    type: String,
    required: true,
    trim: true,
  },
  currentLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 1,
    max: 5,
  },
  totalDeliveries: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Create 2dsphere index for geospatial queries
deliveryPersonnelSchema.index({ currentLocation: "2dsphere" });

// Hash password before saving
deliveryPersonnelSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare plain text to hashed
deliveryPersonnelSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("DeliveryPersonnel", deliveryPersonnelSchema);


const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    date: {
      type: Date,
      required: true
    },

    venue: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      required: true,
      trim: true
    },

    organizer: {
      type: String,
      required: true,
      trim: true
    },

    maxCapacity: {
      type: Number,
      required: true,
      min: 1
    },

    registeredCount: {
      type: Number,
      default: 0,
      min: 0
    },

    imageUrl: {
      type: String,
      default: ""
    },

    // Cloudinary image ID for deleting images
    imagePublicId: {
      type: String,
      default: ""
    },

    coordinatorPhone: {
      type: String,
      required: true,
      trim: true
    },

    createdBy: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending"
    },

    rejectionReason: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

eventSchema.pre("validate", function () {
  if (this.registeredCount > this.maxCapacity) {
    this.invalidate(
      "registeredCount",
      "Registered count cannot exceed maximum capacity."
    );
  }
});

module.exports = mongoose.model("Event", eventSchema);

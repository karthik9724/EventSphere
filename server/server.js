
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==================================================
// CLOUDINARY CONFIGURATION
// ==================================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ==================================================
// EXPRESS CONFIGURATION
// ==================================================

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ==================================================
// DATABASE MODEL
// ==================================================

const Event = require("./models/Event");

// ==================================================
// STUDENT AND COORDINATOR MODEL
// ==================================================

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    rollNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: ""
    },

    phoneNumber: {
      type: String,
      trim: true,
      default: ""
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["student", "coordinator"],
      default: "student",
      required: true
    }
  },
  { timestamps: true }
);

studentSchema.index(
  { email: 1, role: 1 },
  {
    unique: true,
    name: "email_role_unique"
  }
);

studentSchema.index(
  { rollNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: "student",
      rollNumber: { $type: "string", $ne: "" }
    }
  }
);

const Student =
  mongoose.models.Student ||
  mongoose.model("Student", studentSchema);

// ==================================================
// EVENT REGISTRATION MODEL
// ==================================================

const registrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },

    seats: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 5
    },

    attendees: [
      {
        name: {
          type: String,
          required: true,
          trim: true
        },

        rollNumber: {
          type: String,
          required: true,
          uppercase: true,
          trim: true
        }
      }
    ]
  },
  { timestamps: true }
);

registrationSchema.index(
  { event: 1, student: 1 },
  { unique: true }
);

registrationSchema.index(
  { event: 1, "attendees.rollNumber": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "attendees.rollNumber": { $type: "string" }
    }
  }
);

const EventRegistration =
  mongoose.models.EventRegistration ||
  mongoose.model("EventRegistration", registrationSchema);

// ==================================================
// CLOUDINARY IMAGE UPLOAD CONFIGURATION
// ==================================================

// Store uploaded image temporarily in memory.
// The image will be sent directly to Cloudinary.

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPG, PNG, WEBP and GIF images are allowed.")
      );
    }

    callback(null, true);
  }
});

// Handle image upload errors.

function uploadEventImage(req, res, next) {
  upload.single("image")(req, res, error => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next();
  });
}

// Upload image buffer to Cloudinary.

function uploadToCloudinary(fileBuffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "eventsphere/events",
        resource_type: "image"
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      }
    );

    stream.end(fileBuffer);
  });
}

// Delete image from Cloudinary.

async function deleteCloudinaryImage(publicId) {
  if (!publicId) return;

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "image"
  });
}

// ==================================================
// HELPER FUNCTIONS
// ==================================================

function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      rollNumber: user.rollNumber || "",
      phoneNumber: user.phoneNumber || ""
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function getAvailableSeats(event) {
  return Math.max(
    0,
    Number(event.maxCapacity) - Number(event.registeredCount || 0)
  );
}

function normalizeRollNumber(value) {
  return String(value || "").trim().toUpperCase();
}

function isValidRollNumber(value) {
  const rollNumber = normalizeRollNumber(value);

  const rollPattern =
    /^23R11A05(?:0[1-9]|[1-9]\d|[A-Y]\d|Z0)$/;

  return rollPattern.test(rollNumber);
}

function normalizePhoneNumber(value) {
  return String(value || "").trim();
}

function isValidPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function isValidCollegeEmail(value) {
  const email = String(value || "").trim().toLowerCase();

  const emailPattern =
    /^23r11a05(?:0[1-9]|[1-9]\d|[a-y]\d|z0)@gcet\.edu\.in$/;

  return emailPattern.test(email);
}

function getCollegeEmail(rollNumber) {
  return `${normalizeRollNumber(rollNumber).toLowerCase()}@gcet.edu.in`;
}

function getWelcomeMessage(user) {
  if (user.role === "student") {
    return `Welcome, ${user.name}! Your roll number is ${user.rollNumber}.`;
  }

  if (user.role === "coordinator") {
    return `Welcome, ${user.name}! You are logged in as a Coordinator.`;
  }

  return "Welcome, Admin!";
}

// ==================================================
// AUTHENTICATION MIDDLEWARE
// ==================================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is required."
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token."
    });
  }
}

function authenticateStudent(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Student access only."
      });
    }

    next();
  });
}

function authenticateCoordinator(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user.role !== "coordinator") {
      return res.status(403).json({
        success: false,
        message: "Coordinator access only."
      });
    }

    next();
  });
}

function authenticateAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access only."
      });
    }

    next();
  });
}

// ==================================================
// STUDENT AND COORDINATOR REGISTRATION
// ==================================================

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      name,
      rollNumber,
      email,
      password,
      role
    } = req.body;

    if (
      !name ||
      !String(name).trim() ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email and password."
      });
    }

    const selectedRole = role || "student";

    if (!["student", "coordinator"].includes(selectedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration role."
      });
    }

    const normalizedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedRoll = normalizeRollNumber(rollNumber);

    if (normalizedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name must not exceed 100 characters."
      });
    }

    if (!isValidCollegeEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid GCET college email address."
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters."
      });
    }

    if (selectedRole === "student") {
      if (!normalizedRoll) {
        return res.status(400).json({
          success: false,
          message: "College roll number is required."
        });
      }

      if (!isValidRollNumber(normalizedRoll)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid GCET roll number. Accepted range: 23R11A0501 to 23R11A05Z0."
        });
      }

      if (normalizedEmail !== getCollegeEmail(normalizedRoll)) {
        return res.status(400).json({
          success: false,
          message: `Your email must be ${getCollegeEmail(normalizedRoll)}`
        });
      }

      const existingRoll = await Student.findOne({
        role: "student",
        rollNumber: normalizedRoll
      });

      if (existingRoll) {
        return res.status(409).json({
          success: false,
          message: "This college roll number is already registered."
        });
      }
    }

    const existingAccount = await Student.findOne({
      email: normalizedEmail,
      role: selectedRole
    });

    if (existingAccount) {
      return res.status(409).json({
        success: false,
        message: `This email is already registered as a ${selectedRole}.`
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: selectedRole
    };

    if (selectedRole === "student") {
      userData.rollNumber = normalizedRoll;
    }

    if (selectedRole === "coordinator") {
      userData.phoneNumber = "";
      userData.rollNumber = "";
    }

    const user = await Student.create(userData);
    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      welcomeMessage: getWelcomeMessage(user),
      token,
      user: {
        id: user._id,
        name: user.name,
        rollNumber: user.rollNumber || "",
        phoneNumber: user.phoneNumber || "",
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This account or roll number is already registered."
      });
    }

    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed."
    });
  }
});

// ==================================================
// STUDENT AND COORDINATOR LOGIN
// ==================================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, password and login role."
      });
    }

    if (!["student", "coordinator"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid login role."
      });
    }

    const user = await Student.findOne({
      email: String(email).trim().toLowerCase(),
      role
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: `No ${role} account found with this email.`
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const token = createToken(user);

    return res.json({
      success: true,
      message: "Login successful.",
      welcomeMessage: getWelcomeMessage(user),
      token,
      user: {
        id: user._id,
        name: user.name,
        rollNumber: user.rollNumber || "",
        phoneNumber: user.phoneNumber || "",
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed."
    });
  }
});

// ==================================================
// ADMIN LOGIN
// ==================================================

app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      email !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid admin credentials."
      });
    }

    const token = jwt.sign(
      {
        id: "admin",
        name: "Admin",
        email: process.env.ADMIN_EMAIL,
        role: "admin"
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      message: "Admin login successful.",
      welcomeMessage: "Welcome, Admin!",
      token,
      user: {
        name: "Admin",
        email: process.env.ADMIN_EMAIL,
        role: "admin"
      }
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return res.status(500).json({
      success: false,
      message: "Admin login failed."
    });
  }
});

// ==================================================
// COORDINATOR: CREATE EVENT WITH CLOUDINARY IMAGE
// ==================================================

app.post(
  "/api/events",
  authenticateCoordinator,
  uploadEventImage,
  async (req, res) => {
    let uploadedImage = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload an event image."
        });
      }

      const {
        title,
        description,
        date,
        venue,
        category,
        organizer,
        maxCapacity,
        coordinatorPhone
      } = req.body;

      if (
        !title ||
        !description ||
        !date ||
        !venue ||
        !category ||
        !organizer ||
        !maxCapacity
      ) {
        return res.status(400).json({
          success: false,
          message: "Please fill in all required event details."
        });
      }

      const maximum = Number(maxCapacity);

      if (!Number.isInteger(maximum) || maximum < 1) {
        return res.status(400).json({
          success: false,
          message: "Maximum capacity must be a valid number greater than zero."
        });
      }

      const phone = normalizePhoneNumber(coordinatorPhone);

      if (!phone || !isValidPhoneNumber(phone)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid coordinator phone number."
        });
      }

      // Upload image to Cloudinary.
      uploadedImage = await uploadToCloudinary(req.file.buffer);

      // Save event details and Cloudinary image information in MongoDB.
      const event = await Event.create({
        title: title.trim(),
        description: description.trim(),
        date,
        venue: venue.trim(),
        category: category.trim(),
        organizer: organizer.trim(),
        maxCapacity: maximum,
        registeredCount: 0,
        imageUrl: uploadedImage.secure_url,
        imagePublicId: uploadedImage.public_id,
        coordinatorPhone: phone,
        createdBy: req.user.id,
        status: "Pending"
      });

      return res.status(201).json({
        success: true,
        message: "Event submitted for admin approval.",
        event
      });
    } catch (error) {
      // If MongoDB saving fails after Cloudinary upload,
      // delete the uploaded image to avoid unused files.

      if (uploadedImage?.public_id) {
        try {
          await deleteCloudinaryImage(uploadedImage.public_id);
        } catch (cleanupError) {
          console.error(
            "Cloudinary cleanup error:",
            cleanupError.message
          );
        }
      }

      console.error("Create event error:", error);

      return res.status(500).json({
        success: false,
        message: error.message || "Could not create event."
      });
    }
  }
);

// ==================================================
// COORDINATOR: VIEW OWN UPCOMING EVENTS
// PAST EVENTS ARE HIDDEN FROM ACTIVE LIST
// ==================================================

app.get(
  "/api/coordinator/events",
  authenticateCoordinator,
  async (req, res) => {
    try {
      const events = await Event.find({
        createdBy: req.user.id,
        date: { $gt: new Date() }
      }).sort({ createdAt: -1 });

      const result = events.map(event => {
        const item = event.toObject();
        item.availableSeats = getAvailableSeats(event);
        return item;
      });

      return res.json({
        success: true,
        events: result
      });
    } catch (error) {
      console.error("Coordinator events error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not fetch coordinator events."
      });
    }
  }
);

// ==================================================
// COORDINATOR: VIEW REGISTERED STUDENTS FOR OWN EVENT
// HISTORICAL ATTENDEE HISTORY IS PRESERVED
// ==================================================

app.get(
  "/api/coordinator/events/:id/registrations",
  authenticateCoordinator,
  async (req, res) => {
    try {
      const eventId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID."
        });
      }

      const event = await Event.findOne({
        _id: eventId,
        createdBy: req.user.id
      }).select("_id title registeredCount");

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found in your coordinator account."
        });
      }

      const bookings = await EventRegistration.find({ event: eventId })
        .select("attendees")
        .lean();

      const attendees = bookings
        .flatMap(booking => booking.attendees || [])
        .map(person => ({
          name: person.name,
          rollNumber: normalizeRollNumber(person.rollNumber)
        }))
        .filter(person => person.rollNumber)
        .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

      return res.json({
        success: true,
        eventId: event._id,
        eventTitle: event.title,
        registeredCount: Number(event.registeredCount || 0),
        attendees
      });
    } catch (error) {
      console.error("Coordinator registered students error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not load registered students."
      });
    }
  }
);

// ==================================================
// COORDINATOR: DELETE OWN PENDING OR REJECTED EVENT
// ==================================================

app.delete(
  "/api/coordinator/events/:id",
  authenticateCoordinator,
  async (req, res) => {
    try {
      const eventId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID."
        });
      }

      const existingEvent = await Event.findOne({
        _id: eventId,
        createdBy: req.user.id
      });

      if (!existingEvent) {
        return res.status(404).json({
          success: false,
          message: "Event not found in your coordinator account."
        });
      }

      if (!["Pending", "Rejected"].includes(existingEvent.status)) {
        return res.status(403).json({
          success: false,
          message: "Approved events cannot be deleted by coordinators."
        });
      }

      const hasRegistrations = await EventRegistration.exists({
        event: eventId
      });

      if (hasRegistrations) {
        return res.status(409).json({
          success: false,
          message: "This event has registrations and cannot be deleted. Please contact the administrator."
        });
      }

      const deletedEvent = await Event.findOneAndDelete({
        _id: eventId,
        createdBy: req.user.id,
        status: { $in: ["Pending", "Rejected"] }
      });

      if (!deletedEvent) {
        return res.status(409).json({
          success: false,
          message: "The event status changed. Refresh your dashboard and try again."
        });
      }

      // Delete the associated image from Cloudinary.
      if (deletedEvent.imagePublicId) {
        try {
          await deleteCloudinaryImage(deletedEvent.imagePublicId);
        } catch (imageError) {
          console.error(
            "Cloudinary event image deletion error:",
            imageError.message
          );
        }
      }

      return res.json({
        success: true,
        message: "Your event has been deleted successfully."
      });
    } catch (error) {
      console.error("Coordinator delete event error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not delete this event. Please try again."
      });
    }
  }
);

// ==================================================
// PUBLIC: VIEW APPROVED UPCOMING EVENTS
// PAST EVENTS ARE HIDDEN
// ==================================================

app.get("/api/events", async (req, res) => {
  try {
    const events = await Event.find({
      status: "Approved",
      date: { $gt: new Date() }
    }).sort({ date: 1 });

    const result = events.map(event => {
      const item = event.toObject();
      item.availableSeats = getAvailableSeats(event);
      return item;
    });

    return res.json({
      success: true,
      events: result
    });
  } catch (error) {
    console.error("Fetch events error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch events."
    });
  }
});

// ==================================================
// PUBLIC: VIEW SINGLE UPCOMING EVENT
// ==================================================

app.get("/api/events/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID."
      });
    }

    const event = await Event.findOne({
      _id: req.params.id,
      status: "Approved",
      date: { $gt: new Date() }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found."
      });
    }

    const eventData = event.toObject();
    eventData.availableSeats = getAvailableSeats(event);

    return res.json({
      success: true,
      event: eventData
    });
  } catch (error) {
    console.error("Single event error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch event."
    });
  }
});

// ==================================================
// STUDENT: BOOK TICKETS
// ONE OWNER, 1-5 TICKETS TOTAL
// REGISTRATION CLOSES 48 HOURS BEFORE EVENT
// ==================================================

app.post(
  "/api/events/:id/register",
  authenticateStudent,
  async (req, res) => {
    let session;

    try {
      const eventId = req.params.id;
      const seats = Number(req.body.seats ?? 1);
      const submittedAttendees = req.body.attendees ?? [];

      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID."
        });
      }

      if (!Number.isInteger(seats) || seats < 1 || seats > 5) {
        return res.status(400).json({
          success: false,
          message: "You can book between 1 and 5 tickets."
        });
      }

      if (
        !Array.isArray(submittedAttendees) ||
        submittedAttendees.length !== seats
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a GCET roll number for every ticket."
        });
      }

      const bookingStudent = await Student.findOne({
        _id: req.user.id,
        role: "student"
      }).select("_id name rollNumber");

      if (!bookingStudent) {
        return res.status(404).json({
          success: false,
          message: "Student account not found."
        });
      }

      const allRollNumbers = submittedAttendees.map(person =>
        normalizeRollNumber(person?.rollNumber)
      );

      for (let index = 0; index < allRollNumbers.length; index++) {
        if (!isValidRollNumber(allRollNumbers[index])) {
          return res.status(400).json({
            success: false,
            message: `Enter a valid GCET roll number for ticket ${index + 1}.`
          });
        }
      }

      if (new Set(allRollNumbers).size !== allRollNumbers.length) {
        return res.status(409).json({
          success: false,
          message: "Duplicate roll number found. Each ticket must belong to a different student."
        });
      }

      const registeredStudents = await Student.find({
        role: "student",
        rollNumber: { $in: allRollNumbers }
      }).select("_id name rollNumber");

      const studentsByRoll = new Map(
        registeredStudents.map(person => [
          normalizeRollNumber(person.rollNumber),
          person
        ])
      );

      const missingRoll = allRollNumbers.find(
        roll => !studentsByRoll.has(roll)
      );

      if (missingRoll) {
        return res.status(404).json({
          success: false,
          message: "This student is not registered on EventSphere. Please ask them to create an account before booking a ticket for them.",
          unregisteredRollNumber: missingRoll
        });
      }

      const attendees = allRollNumbers.map(roll => {
        const person = studentsByRoll.get(roll);

        return {
          name: person.name,
          rollNumber: normalizeRollNumber(person.rollNumber)
        };
      });

      session = await mongoose.startSession();
      let responseData = null;

      await session.withTransaction(async () => {
        // Registration closes exactly 48 hours before event start.
        const bookingCutoff = new Date(
          Date.now() + 48 * 60 * 60 * 1000
        );

        const eventForBooking = await Event.findOne({
          _id: eventId,
          status: "Approved"
        }).session(session);

        if (!eventForBooking) {
          const error = new Error("Approved event not found.");
          error.statusCode = 404;
          throw error;
        }

        if (eventForBooking.date <= bookingCutoff) {
          const error = new Error(
            "Registration is closed. Ticket booking must be completed at least 2 days before the event."
          );
          error.statusCode = 400;
          throw error;
        }

        const existingBooking = await EventRegistration.findOne({
          event: eventId,
          student: bookingStudent._id
        }).session(session);

        const alreadyBooked = await EventRegistration.findOne({
          event: eventId,
          "attendees.rollNumber": { $in: allRollNumbers }
        }).session(session);

        if (alreadyBooked) {
          const error = new Error(
            "One or more students are already registered for this event!"
          );
          error.statusCode = 409;
          throw error;
        }

        if (
          existingBooking &&
          Number(existingBooking.seats || 0) + seats > 5
        ) {
          const error = new Error(
            `You already have ${existingBooking.seats} ticket(s) in your booking. You can add only ${5 - existingBooking.seats} more ticket(s). The maximum is 5 tickets per owner.`
          );
          error.statusCode = 409;
          throw error;
        }

        // Atomically reserve seats and check the booking deadline.
        const updatedEvent = await Event.findOneAndUpdate(
          {
            _id: eventId,
            status: "Approved",
            date: { $gt: bookingCutoff },
            $expr: {
              $lte: [
                {
                  $add: [
                    { $ifNull: ["$registeredCount", 0] },
                    seats
                  ]
                },
                { $ifNull: ["$maxCapacity", 100] }
              ]
            }
          },
          { $inc: { registeredCount: seats } },
          {
            new: true,
            runValidators: true,
            session
          }
        );

        if (!updatedEvent) {
          const event = await Event.findById(eventId).session(session);

          if (!event || event.status !== "Approved") {
            const error = new Error("Approved event not found.");
            error.statusCode = 404;
            throw error;
          }

          if (
            event.date <= new Date(Date.now() + 48 * 60 * 60 * 1000)
          ) {
            const error = new Error(
              "Registration is closed. Ticket booking must be completed at least 2 days before the event."
            );
            error.statusCode = 400;
            throw error;
          }

          const error = new Error(
            `Only ${getAvailableSeats(event)} seats are available.`
          );
          error.statusCode = 400;
          error.availableSeats = getAvailableSeats(event);
          throw error;
        }

        let registration;

        if (existingBooking) {
          registration = await EventRegistration.findOneAndUpdate(
            {
              _id: existingBooking._id,
              seats: { $lte: 5 - seats }
            },
            {
              $push: { attendees: { $each: attendees } },
              $inc: { seats }
            },
            { new: true, runValidators: true, session }
          );

          if (!registration) {
            const error = new Error(
              "Your booking has reached the 5-ticket limit. Refresh and try again."
            );
            error.statusCode = 409;
            throw error;
          }
        } else {
          [registration] = await EventRegistration.create(
            [{
              event: updatedEvent._id,
              student: bookingStudent._id,
              seats,
              attendees
            }],
            { session }
          );
        }

        responseData = {
          registration,
          registeredCount: updatedEvent.registeredCount,
          availableSeats: getAvailableSeats(updatedEvent)
        };
      });

      return res.status(201).json({
        success: true,
        message: `${seats} ticket(s) booked successfully. Your total booking is now ${responseData.registration.seats} ticket(s).`,
        registration: responseData.registration,
        seats: responseData.registration.seats,
        attendees: responseData.registration.attendees,
        registeredCount: responseData.registeredCount,
        availableSeats: responseData.availableSeats
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "One or more students are already registered for this event!"
        });
      }

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          ...(error.availableSeats !== undefined
            ? { availableSeats: error.availableSeats }
            : {})
        });
      }

      console.error("Event booking error:", error);

      return res.status(500).json({
        success: false,
        message: "Booking failed. Please try again."
      });
    } finally {
      if (session) await session.endSession();
    }
  }
);

// ==================================================
// STUDENT: VIEW MY REGISTRATIONS
// OWNER + INVITED STUDENT
// HISTORICAL REGISTRATIONS ARE PRESERVED
// ==================================================

app.get(
  "/api/my-registrations",
  authenticateStudent,
  async (req, res) => {
    try {
      const currentStudent = await Student.findOne({
        _id: req.user.id,
        role: "student"
      }).select("_id name rollNumber");

      if (!currentStudent) {
        return res.status(404).json({
          success: false,
          message: "Student account not found."
        });
      }

      const currentRoll = normalizeRollNumber(currentStudent.rollNumber);

      const registrations = await EventRegistration.find({
        $or: [
          { student: currentStudent._id },
          { "attendees.rollNumber": currentRoll }
        ]
      })
        .populate("event")
        .populate("student", "name rollNumber email")
        .sort({ createdAt: -1 });

      const result = registrations
        .map(item => {
          const registration = item.toObject();
          const allAttendees = registration.attendees || [];

          const isOwnBooking =
            String(registration.student?._id || registration.student) ===
            String(currentStudent._id);

          const myTicket = allAttendees.find(attendee =>
            normalizeRollNumber(attendee.rollNumber) === currentRoll
          );

          if (!myTicket && !isOwnBooking) return null;

          registration.totalSeats = Number(
            registration.seats || allAttendees.length || 1
          );

          registration.isOwnBooking = isOwnBooking;

          registration.bookedBy = registration.student
            ? {
                id: registration.student._id,
                name: registration.student.name,
                rollNumber: registration.student.rollNumber
              }
            : null;

          registration.myTicket = myTicket || null;

          registration.attendees = isOwnBooking
            ? allAttendees
            : (myTicket ? [myTicket] : []);

          return registration;
        })
        .filter(Boolean);

      return res.json({
        success: true,
        registrations: result
      });
    } catch (error) {
      console.error("My registrations error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not fetch your registrations."
      });
    }
  }
);

// ==================================================
// STUDENT: CANCEL THE ENTIRE BOOKING
// BOOKING OWNER ONLY
// CANCELLATION CLOSES 24 HOURS BEFORE EVENT
// ==================================================

app.delete(
  "/api/registrations/:registrationId",
  authenticateStudent,
  async (req, res) => {
    let session;

    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.registrationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid registration ID."
        });
      }

      session = await mongoose.startSession();
      let result = null;

      await session.withTransaction(async () => {
        const registration = await EventRegistration.findById(
          req.params.registrationId
        ).session(session);

        if (!registration) {
          const error = new Error("This booking no longer exists.");
          error.statusCode = 404;
          throw error;
        }

        if (String(registration.student) !== String(req.user.id)) {
          const error = new Error(
            "Only the student who created this booking can cancel the entire booking."
          );
          error.statusCode = 403;
          throw error;
        }

        const event = await Event.findById(registration.event).session(session);

        if (!event) {
          const error = new Error("Event not found.");
          error.statusCode = 404;
          throw error;
        }

        // Cancellation is blocked from 24 hours before event start.
        const cancellationCutoff = new Date(
          Date.now() + 24 * 60 * 60 * 1000
        );

        if (event.date <= cancellationCutoff) {
          const error = new Error(
            "Ticket cancellation is closed. You can cancel tickets only until 24 hours before the event."
          );
          error.statusCode = 400;
          throw error;
        }

        const seatsToRelease = Number(registration.seats || 0);

        const updatedEvent = await Event.findOneAndUpdate(
          {
            _id: registration.event,
            registeredCount: { $gte: seatsToRelease }
          },
          { $inc: { registeredCount: -seatsToRelease } },
          { new: true, session }
        );

        if (!updatedEvent) {
          const error = new Error(
            "Could not update event seat counts. Please contact the administrator."
          );
          error.statusCode = 409;
          throw error;
        }

        await EventRegistration.deleteOne(
          { _id: registration._id },
          { session }
        );

        result = {
          releasedSeats: seatsToRelease,
          registeredCount: updatedEvent.registeredCount,
          availableSeats: getAvailableSeats(updatedEvent)
        };
      });

      return res.json({
        success: true,
        message: "Your booking and all remaining tickets have been cancelled.",
        ...result
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      console.error("Cancel booking error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not cancel this booking. Please try again."
      });
    } finally {
      if (session) await session.endSession();
    }
  }
);

// ==================================================
// STUDENT: CANCEL ONLY THEIR OWN INVITED TICKET
// CANCELLATION CLOSES 24 HOURS BEFORE EVENT
// ==================================================

app.delete(
  "/api/registrations/:registrationId/my-ticket",
  authenticateStudent,
  async (req, res) => {
    let session;

    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.registrationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid registration ID."
        });
      }

      const currentStudent = await Student.findOne({
        _id: req.user.id,
        role: "student"
      }).select("_id rollNumber");

      if (!currentStudent || !currentStudent.rollNumber) {
        return res.status(404).json({
          success: false,
          message: "Student account not found."
        });
      }

      const currentRoll = normalizeRollNumber(currentStudent.rollNumber);

      session = await mongoose.startSession();
      let result = null;

      await session.withTransaction(async () => {
        const registration = await EventRegistration.findOne({
          _id: req.params.registrationId,
          student: { $ne: currentStudent._id },
          "attendees.rollNumber": currentRoll
        }).session(session);

        if (!registration) {
          const error = new Error(
            "Your ticket was not found or has already been cancelled."
          );
          error.statusCode = 404;
          throw error;
        }

        const event = await Event.findById(registration.event).session(session);

        if (!event) {
          const error = new Error("Event not found.");
          error.statusCode = 404;
          throw error;
        }

        // Cancellation is blocked from 24 hours before event start.
        const cancellationCutoff = new Date(
          Date.now() + 24 * 60 * 60 * 1000
        );

        if (event.date <= cancellationCutoff) {
          const error = new Error(
            "Ticket cancellation is closed. You can cancel tickets only until 24 hours before the event."
          );
          error.statusCode = 400;
          throw error;
        }

        const seatsBeforeCancellation = Number(registration.seats || 0);

        if (seatsBeforeCancellation <= 0) {
          const error = new Error("This booking has no remaining tickets.");
          error.statusCode = 409;
          throw error;
        }

        let updatedRegistration = null;

        if (seatsBeforeCancellation === 1) {
          await EventRegistration.deleteOne(
            { _id: registration._id },
            { session }
          );
        } else {
          updatedRegistration = await EventRegistration.findOneAndUpdate(
            {
              _id: registration._id,
              student: { $ne: currentStudent._id },
              seats: { $gt: 1 },
              "attendees.rollNumber": currentRoll
            },
            {
              $pull: {
                attendees: { rollNumber: currentRoll }
              },
              $inc: { seats: -1 }
            },
            { new: true, session }
          );

          if (!updatedRegistration) {
            const error = new Error("Your ticket was already cancelled.");
            error.statusCode = 409;
            throw error;
          }
        }

        const updatedEvent = await Event.findOneAndUpdate(
          {
            _id: registration.event,
            registeredCount: { $gte: 1 }
          },
          { $inc: { registeredCount: -1 } },
          { new: true, session }
        );

        if (!updatedEvent) {
          const error = new Error(
            "Could not update event seat counts. Please contact the administrator."
          );
          error.statusCode = 409;
          throw error;
        }

        result = {
          releasedSeats: 1,
          bookingRemoved: seatsBeforeCancellation === 1,
          remainingSeatsInBooking: updatedRegistration
            ? updatedRegistration.seats
            : 0,
          registeredCount: updatedEvent.registeredCount,
          availableSeats: getAvailableSeats(updatedEvent)
        };
      });

      return res.json({
        success: true,
        message: "Your ticket has been cancelled. The other students' tickets are unchanged.",
        ...result
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }

      console.error("Cancel individual ticket error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not cancel your ticket. Please try again."
      });
    } finally {
      if (session) await session.endSession();
    }
  }
);

// ==================================================
// ADMIN: VIEW PENDING EVENTS
// ==================================================

app.get(
  "/api/admin/events/pending",
  authenticateAdmin,
  async (req, res) => {
    try {
      const events = await Event.find({
        status: "Pending"
      }).sort({ createdAt: -1 });

      return res.json({
        success: true,
        events
      });
    } catch (error) {
      console.error("Pending events error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not fetch pending events."
      });
    }
  }
);

// ==================================================
// ADMIN: APPROVE EVENT
// ==================================================

app.patch(
  "/api/admin/events/:id/approve",
  authenticateAdmin,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID."
        });
      }

      const event = await Event.findOneAndUpdate(
        {
          _id: req.params.id,
          status: "Pending"
        },
        {
          $set: {
            status: "Approved",
            rejectionReason: ""
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Pending event not found."
        });
      }

      return res.json({
        success: true,
        message: "Event approved successfully.",
        event
      });
    } catch (error) {
      console.error("Approve event error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not approve event."
      });
    }
  }
);

// ==================================================
// ADMIN: REJECT EVENT
// ==================================================

app.patch(
  "/api/admin/events/:id/reject",
  authenticateAdmin,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID."
        });
      }

      const rejectionReason =
        req.body.rejectionReason || req.body.reason || "";

      const event = await Event.findOneAndUpdate(
        {
          _id: req.params.id,
          status: "Pending"
        },
        {
          $set: {
            status: "Rejected",
            rejectionReason
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Pending event not found."
        });
      }

      return res.json({
        success: true,
        message: "Event rejected successfully.",
        event
      });
    } catch (error) {
      console.error("Reject event error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not reject event."
      });
    }
  }
);

// ==================================================
// ERROR HANDLER
// ==================================================

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    success: false,
    message: "An unexpected server error occurred."
  });
});

// ==================================================
// DATABASE INDEX MIGRATION
// ==================================================

async function migrateStudentIndexes() {
  const indexes = await Student.collection.indexes();

  const oldEmailIndex = indexes.find(index =>
    index.name === "email_1" &&
    index.unique === true
  );

  if (oldEmailIndex) {
    await Student.collection.dropIndex("email_1");
    console.log("Old email unique index removed.");
  }

  await Student.collection.createIndex(
    { email: 1, role: 1 },
    {
      unique: true,
      name: "email_role_unique"
    }
  );

  console.log("Email and role index is ready.");
}

// ==================================================
// DATABASE CONNECTION AND SERVER START
// ==================================================

async function startServer() {
  try {
    if (
      !process.env.MONGODB_URI ||
      !process.env.ADMIN_EMAIL ||
      !process.env.ADMIN_PASSWORD ||
      !process.env.JWT_SECRET ||
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error(
        "Missing required environment variables. Check your .env file."
      );
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully.");

    await migrateStudentIndexes();

    app.listen(PORT, () => {
      console.log(`EventSphere server running on port ${PORT}`);
      console.log("Cloudinary image storage is configured.");
    });
  } catch (error) {
    console.error("Server startup error:", error.message);
    process.exit(1);
  }
}

startServer();


const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const fs = require("fs");

const Event = require("./models/Event");

dotenv.config();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload one image to Cloudinary
async function uploadToCloudinary(filePath) {
  return cloudinary.uploader.upload(filePath, {
    folder: "eventsphere/events",
    resource_type: "image"
  });
}

async function migrateImages() {
  try {
    // Check required environment variables
    if (
      !process.env.MONGODB_URI ||
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error("Missing MongoDB or Cloudinary environment variables.");
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully.");

    // Find events still using old local image paths
    const events = await Event.find({
      imageUrl: /^\/uploads\//
    });

    console.log(`Found ${events.length} old event images.`);

    if (events.length === 0) {
      console.log("All event images are already migrated.");
      return;
    }

    let successCount = 0;
    let failedCount = 0;

    for (const event of events) {
      let uploadedImage = null;

      try {
        // Extract filename safely
        const filename = path.basename(
          event.imageUrl.replace(/^\/uploads\//, "")
        );

        // Locate old image
        const localImagePath = path.join(
          __dirname,
          "uploads",
          filename
        );

        console.log(`\nProcessing: ${event.title}`);
        console.log(`Local image: ${filename}`);

        // Check whether old image exists
        if (!fs.existsSync(localImagePath)) {
          throw new Error(`Image not found: ${localImagePath}`);
        }

        // Upload to Cloudinary
        uploadedImage = await uploadToCloudinary(localImagePath);

        // Update only image fields in MongoDB
        const result = await Event.updateOne(
          {
            _id: event._id,
            imageUrl: event.imageUrl
          },
          {
            $set: {
              imageUrl: uploadedImage.secure_url,
              imagePublicId: uploadedImage.public_id
            }
          }
        );

        if (result.modifiedCount === 0) {
          // Avoid leaving an unused Cloudinary image
          await cloudinary.uploader.destroy(
            uploadedImage.public_id,
            { resource_type: "image" }
          );

          throw new Error("MongoDB record was not updated.");
        }

        successCount++;

        console.log("Uploaded successfully!");
        console.log("Cloudinary URL:", uploadedImage.secure_url);
      } catch (error) {
        failedCount++;

        // Clean up Cloudinary image if database update failed
        if (uploadedImage?.public_id) {
          try {
            await cloudinary.uploader.destroy(
              uploadedImage.public_id,
              { resource_type: "image" }
            );
          } catch (cleanupError) {
            console.error("Cloudinary cleanup failed:", cleanupError.message);
          }
        }

        console.error("Migration failed:", error.message);
      }
    }

    console.log("\n========== MIGRATION SUMMARY ==========");
    console.log("Total events:", events.length);
    console.log("Successfully migrated:", successCount);
    console.log("Failed:", failedCount);
    console.log("========================================");

  } catch (error) {
    console.error("Migration error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  }
}

migrateImages();

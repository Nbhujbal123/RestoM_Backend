// Load dotenv at the very top
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

// Routes
const authRoutes = require("./Routes/authRoutes");
const menuRoutes = require("./Routes/menuRoutes");
const orderRoutes = require("./Routes/orderRoutes");
const billRoutes = require("./Routes/billRoutes");

const app = express();

// Use environment PORT (Render provides this) or default to 5000
const PORT = process.env.PORT || 5000;

// CORS configuration for production deployment
// Allow requests from Render's domain and localhost for development
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  // Add Render production domain if available in environment
  ...(process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL] : []),
];

// More permissive CORS for production - allow any Render domain
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    // Or allow if origin is in allowed list
    // Or allow if we're in production (Render sets RENDER_EXTERNAL_URL)
    if (!origin || allowedOrigins.includes(origin) || process.env.RENDER_EXTERNAL_URL) {
      return callback(null, true);
    }
    // In development, still allow localhost origins
    if (origin.startsWith("http://localhost")) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Apply CORS middleware
app.use(cors(corsOptions));

app.use(express.json()); // replaces body-parser

// ---------- Routes ----------
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/bills", billRoutes);

// ---------- Health Check ----------
app.get("/", (req, res) => {
  res.status(200).send("🚀 Server is running fine!");
});

// ---------- Debug (remove in production) ----------
console.log("Mongo URI Loaded:", process.env.MONGO_URI ? "Yes" : "No");
console.log("PORT:", PORT);
console.log("Environment:", process.env.NODE_ENV || "development");

// ---------- Start Server with MongoDB Connection ----------
const startServer = async () => {
  console.log("Connecting to MongoDB Atlas...");
  
  try {
    // Check if MONGO_URI is available
    if (!process.env.MONGO_URI) {
      console.error("ERROR: MONGO_URI environment variable is not set!");
      console.log("Please set MONGO_URI in your .env file or Render dashboard");
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGO_URI, {
      family: 4, // Force IPv4
    });
    
    console.log("✅ MongoDB Atlas Connected Successfully");
    
    // Start Express server after successful MongoDB connection
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Local: http://localhost:${PORT}`);
      if (process.env.RENDER_EXTERNAL_URL) {
        console.log(`   Production: ${process.env.RENDER_EXTERNAL_URL}`);
      }
    });
    
  } catch (error) {
    console.error("❌ MongoDB Atlas Connection Failed:");
    console.error("   Error:", error.message);
    
    // Try fallback URI if available (optional)
    if (process.env.FALLBACK_URI) {
      console.log("Attempting fallback to local MongoDB...");
      try {
        await mongoose.connect(process.env.FALLBACK_URI, {
          family: 4,
        });
        console.log("✅ Local MongoDB Connected (fallback)");
        
        app.listen(PORT, () => {
          console.log(`🚀 Server running on port ${PORT}`);
        });
      } catch (fallbackError) {
        console.error("❌ Fallback MongoDB Connection Also Failed:");
        console.error("   Error:", fallbackError.message);
        process.exit(1);
      }
    } else {
      console.log("Note: No FALLBACK_URI configured. Server will exit.");
      console.log("Please check your MongoDB Atlas connection string in Render dashboard");
      process.exit(1);
    }
  }
};

// Handle uncaught exceptions gracefully
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

// Start the server
startServer();

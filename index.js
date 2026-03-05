const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

// Always load env from Backend/.env regardless of where node is started from
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Routes
const authRoutes = require("./Routes/authRoutes");
const menuRoutes = require("./Routes/menuRoutes");
const orderRoutes = require("./Routes/orderRoutes");
const billRoutes = require("./Routes/billRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
];

// ---------- Middleware ----------
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow REST tools / server-to-server requests without Origin header
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

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
console.log("Mongo URI Loaded:", process.env.MONGO_URI?.startsWith("mongodb"));

// ---------- Start Server ----------
const startServer = async () => {
  console.log("Connecting to MongoDB Atlas...");
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      family: 4,
    });
    console.log("MongoDB Atlas Connected");
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB Atlas Connection Failed:", error.message);
    process.exit(1);
  }
};

startServer();

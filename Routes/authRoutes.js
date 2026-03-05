// Backend/Routes/authRoutes.js
const express = require("express");
const router = express.Router();
const {
  signup,
  verifyOtp,
  login,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} = require("../controllers/authController");

router.post("/signup", signup);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

module.exports = router;

// Backend/controllers/authController.js
const User = require("../model/userModel");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

// 🔹 Setup email transporter
const EMAIL_USER = process.env.EMAIL_USER?.trim();
const EMAIL_PASS = process.env.EMAIL_PASS?.replace(/\s+/g, "");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    // Gmail app passwords are often copied with spaces; remove them safely
    pass: EMAIL_PASS,
  },
});

// 🔹 Generate random 6-digit OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// 🔹 Send OTP email helper with local-dev fallback
const sendOtpEmail = async (email, otp, subject) => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error("Email service is not configured. Check EMAIL_USER/EMAIL_PASS.");
  }

  const mailOptions = {
    from: `"RestoM App" <${EMAIL_USER}>`,
    to: email,
    subject,
    text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
  };

  await transporter.sendMail(mailOptions);
  return { sent: true };
};

// ========== SIGNUP ==========
exports.signup = async (req, res) => {
  try {
    const { name, email, phone, mobile, password } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedMobile = (phone || mobile || "").toString().trim();

    // Validation
    if (!name || !normalizedEmail || !normalizedMobile || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();

    let user = await User.findOne({ email: normalizedEmail });

    if (user && user.isVerified) {
      return res.status(409).json({ message: "Email already registered" });
    }

    if (!user) {
      user = new User({
        name,
        email: normalizedEmail,
        mobile: normalizedMobile,
        password: hashedPassword,
        otp,
        otpExpires: Date.now() + 10 * 60 * 1000,
      });
    } else {
      // Existing but unverified user -> refresh details & OTP
      user.name = name;
      user.mobile = normalizedMobile;
      user.password = hashedPassword;
      user.otp = otp;
      user.otpExpires = Date.now() + 10 * 60 * 1000;
    }

    await user.save();

    try {
      await sendOtpEmail(normalizedEmail, otp, "Verify your email - RestoM");
      return res.status(201).json({ message: "OTP sent to email" });
    } catch (emailError) {
      console.error("Signup OTP email send failed:", emailError.message);
      return res.status(502).json({
        message:
          "Signup created, but OTP email could not be sent. Please check mail configuration and try again.",
      });
    }
  } catch (error) {
    console.error("Signup error:", error.message);
    res.status(500).json({ message: "Signup failed due to server error" });
  }
};

// ========== VERIFY OTP ==========
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedOtp = (otp || "").toString().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otp !== normalizedOtp)
      return res.status(400).json({ message: "Invalid OTP" });
    if (user.otpExpires < Date.now())
      return res.status(400).json({ message: "OTP expired" });

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "OTP verification failed", error: error.message });
  }
};

// ========== LOGIN ==========
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.isVerified)
      return res.status(403).json({ message: "Email not verified" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.mobile,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

// ========== FORGOT PASSWORD ==========
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    try {
      await sendOtpEmail(normalizedEmail, otp, "Reset your password - RestoM");
      res.json({ message: "OTP sent to email" });
    } catch (emailError) {
      console.error("Forgot password OTP email send failed:", emailError.message);
      res.status(502).json({
        message: "Failed to send OTP email. Please verify mail configuration.",
      });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Forgot password failed", error: error.message });
  }
};

// ========== VERIFY RESET OTP ==========
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedOtp = (otp || "").toString().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otp !== normalizedOtp)
      return res.status(400).json({ message: "Invalid OTP" });
    if (user.otpExpires < Date.now())
      return res.status(400).json({ message: "OTP expired" });

    // Don't clear OTP yet, will clear after password reset
    res.json({ message: "OTP verified" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "OTP verification failed", error: error.message });
  }
};

// ========== RESET PASSWORD ==========
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Password reset failed", error: error.message });
  }
};

// Backend/Routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const {
  createOrder,
  getAllOrders,
  getOrdersByUser,
  getOrdersByEmail,
  getOrderById,
  updateOrderStatus,
  getDashboardStats,
  generateBillsForCompletedOrders,
} = require("../controllers/orderController");

// Routes

router.post("/", createOrder);
router.get("/", getAllOrders);
router.get("/admin", getAllOrders);
router.get("/stats", getDashboardStats);
router.get("/generate-bills", generateBillsForCompletedOrders);
router.get("/user/:userId", getOrdersByUser);
router.get("/email/:email", getOrdersByEmail);
router.put("/:id/status", updateOrderStatus);
router.get("/:orderId", getOrderById);

module.exports = router;

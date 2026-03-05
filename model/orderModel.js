// Backend/model/orderModel.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  tableNumber: { type: String, default: null },
  orderType: { 
    type: String, 
    enum: ["delivery", "dine-in", "takeaway"], 
    default: "delivery" 
  },
  customer: {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
  },
  items: [
    {
      menuItemId: { type: Number, required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
    },
  ],
  total: { type: Number, required: true },
  orderStatus: {
    type: String,
    enum: ["PENDING", "PREPARING", "READY", "COMPLETED", "DELIVERED"],
    default: "PENDING",
  },
  isBilled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);

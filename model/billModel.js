// Backend/model/billModel.js
const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false, // Optional for guest orders
  },
  customerName: { type: String, required: true },
  customerEmail: { type: String },
  customerPhone: { type: String },
  tableNumber: { type: String },
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }], // Track multiple orders
  items: [
    {
      productId: { type: Number, required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
    },
  ],
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["UNPAID", "PAID"],
    default: "UNPAID",
  },
  paymentMethod: { type: String, default: "CASH" },
  createdAt: { type: Date, default: Date.now },
});

// Auto-generate invoice number before saving
billSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('Bill').countDocuments();
    this.invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model("Bill", billSchema);

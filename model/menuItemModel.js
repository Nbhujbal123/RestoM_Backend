// Backend/model/menuItemModel.js
const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: { type: String, required: true },
  description: { type: String, required: true },
  foodType: { type: String, enum: ["veg", "non-veg"], default: "veg" },
  spiceLevel: { type: String, enum: ["mild", "medium", "hot"], default: "medium" },
});

module.exports = mongoose.model("MenuItem", menuItemSchema);

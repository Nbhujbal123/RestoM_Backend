// Backend/controllers/menuController.js
const MenuItem = require("../model/menuItemModel");

// Get all menu items
exports.getAllMenuItems = async (req, res) => {
  try {
    const menuItems = await MenuItem.find();
    res.json(menuItems);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching menu items", error: error.message });
  }
};

// Get menu item by ID
exports.getMenuItemById = async (req, res) => {
  try {
    const menuItem = await MenuItem.findOne({ id: req.params.id });
    if (!menuItem)
      return res.status(404).json({ message: "Menu item not found" });
    res.json(menuItem);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching menu item", error: error.message });
  }
};

// Create new menu item
exports.createMenuItem = async (req, res) => {
  try {
    const { id, name, price, category, image, description, foodType, spiceLevel } =
      req.body;

    console.log("Received menu item data:", {
      id,
      name,
      price,
      category,
      image,
      description,
      foodType,
      spiceLevel,
    });

    // Check if id already exists
    const existingItem = await MenuItem.findOne({ id });
    if (existingItem)
      return res
        .status(400)
        .json({ message: "Menu item with this ID already exists" });

    const newMenuItem = new MenuItem({
      id,
      name,
      price,
      category,
      image,
      description,
      foodType,
      spiceLevel: spiceLevel || "medium", // Default to medium if not provided
    });

    await newMenuItem.save();
    res.status(201).json({
      message: "Menu item created successfully",
      menuItem: newMenuItem,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating menu item", error: error.message });
  }
};

// Update menu item
exports.updateMenuItem = async (req, res) => {
  try {
    const { name, price, category, image, description, foodType, spiceLevel } =
      req.body;

    const updatedItem = await MenuItem.findOneAndUpdate(
      { id: req.params.id },
      {
        name,
        price,
        category,
        image,
        description,
        foodType,
        spiceLevel: spiceLevel || "medium" // Default to medium if not provided
      },
      { new: true }
    );

    if (!updatedItem)
      return res.status(404).json({ message: "Menu item not found" });

    res.json({
      message: "Menu item updated successfully",
      menuItem: updatedItem,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating menu item", error: error.message });
  }
};

// Delete menu item
exports.deleteMenuItem = async (req, res) => {
  try {
    const deletedItem = await MenuItem.findOneAndDelete({ id: req.params.id });
    if (!deletedItem)
      return res.status(404).json({ message: "Menu item not found" });
    res.json({ message: "Menu item deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting menu item", error: error.message });
  }
};

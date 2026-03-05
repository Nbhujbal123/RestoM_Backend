// Backend/controllers/orderController.js
const Order = require("../model/orderModel");
const Bill = require("../model/billModel");
const User = require("../model/userModel");

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const { user, items, totalAmount, customer, tableNumber, orderType } = req.body;

    console.log("Creating order with customer data:", customer);

    // Format items with proper menuItemId
    const formattedItems = items.map((item) => ({
      menuItemId: item.id || item.menuItemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    const newOrder = new Order({
      user: user || null, // Allow null for guest orders
      tableNumber: tableNumber || null,
      orderType: orderType || 'delivery',
      customer: customer || { name: 'Guest', email: '', phone: '', address: '' }, // Store customer info for guest orders
      items: formattedItems,
      total: totalAmount,
    });

    await newOrder.save();
    console.log("Order saved:", newOrder);

    res
      .status(201)
      .json({ message: "Order created successfully", order: newOrder });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating order", error: error.message });
  }
};

// Get orders for a user
exports.getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Fetching orders for user:", userId);
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
    console.log("Orders found:", orders.length);
    res.json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching orders", error: error.message });
  }
};

// Get all orders for a customer by email
exports.getOrdersByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    console.log("Fetching orders for email:", email);
    
    // First find the user by email
    const user = await User.findOne({ email: new RegExp("^" + email + "$", "i") });
    
    let orders = [];
    if (user) {
      // If user exists, find orders by user ID
      orders = await Order.find({ user: user._id }).sort({ createdAt: -1 });
    }
    
    // Also fetch orders that have customer.email matching (for guest orders with email)
    const guestOrders = await Order.find({
      'customer.email': new RegExp("^" + email + "$", "i")
    }).sort({ createdAt: -1 });
    
    // Merge orders, avoiding duplicates
    const orderIds = new Set(orders.map(o => o._id.toString()));
    guestOrders.forEach(order => {
      if (!orderIds.has(order._id.toString())) {
        orders.push(order);
      }
    });
    
    // Sort by date
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log("Orders found:", orders.length);
    res.json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching orders", error: error.message });
  }
};

// Get all orders (for admin)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching orders", error: error.message });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all orders
    const allOrders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    // Filter today's orders
    const todayOrders = allOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= today && orderDate < tomorrow;
    });

    // Calculate today's revenue
    const todayRevenue = todayOrders.reduce((sum, order) => {
      return sum + (order.total || order.items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0));
    }, 0);

    // Count pending orders (all pending, not just today)
    const pendingOrders = allOrders.filter(o => o.orderStatus === 'PENDING').length;

    // Count completed orders today (support both COMPLETED and DELIVERED)
    const completedToday = todayOrders.filter(o => o.orderStatus === 'COMPLETED' || o.orderStatus === 'DELIVERED').length;

    // Total orders today
    const todayOrdersCount = todayOrders.length;

    res.json({
      todayOrders: todayOrdersCount,
      todayRevenue: todayRevenue.toFixed(2),
      pendingOrders,
      completedToday,
      recentOrders: allOrders.slice(0, 10)
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching statistics", error: error.message });
  }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching order", error: error.message });
  }
};

// Update order status by id (for admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    console.log("=== UPDATE ORDER STATUS ===");
    console.log("Order ID:", req.params.id);
    console.log("New Status:", status);
    
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus: status },
      { new: true }
    ).populate("user", "name email");
    
    if (!updatedOrder) {
      console.log("Order not found!");
      return res.status(404).json({ message: "Order not found" });
    }
    
    console.log("Order updated. isBilled:", updatedOrder.isBilled);
    console.log("Order customer data:", updatedOrder.customer);

    // If order is completed/delivered and not already billed, create bill
    if ((status === "COMPLETED" || status === "DELIVERED") && !updatedOrder.isBilled) {
      console.log("=== PROCESSING BILLING ===");
      console.log("Order " + updatedOrder._id + " status changed to " + status + ". Processing billing.");
      
      // Process billing for all orders (registered users and guest orders)
      const billItems = updatedOrder.items.map((item) => ({
        productId: item.menuItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      if (updatedOrder.user) {
        // Registered user - find or create bill with customerId
        const userDoc = updatedOrder.user;
        console.log("Registered user - customerId:", userDoc._id);
        console.log("Finding UNPAID bill for customer " + userDoc._id + " (" + userDoc.name + ")");
        let bill = await Bill.findOne({
          customerId: userDoc._id,
          status: "UNPAID",
        });

        if (bill) {
          console.log("Found existing UNPAID bill " + bill._id + ". Appending " + billItems.length + " items.");
          // Append items and recalculate total
          bill.items.push(...billItems);
          const subtotal = bill.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );
          bill.subtotal = subtotal;
          bill.totalAmount = subtotal;
          // Add order to orderIds array if not already there
          if (bill.orderIds && !bill.orderIds.includes(updatedOrder._id)) {
            bill.orderIds.push(updatedOrder._id);
          }
          await bill.save();
          console.log("Bill " + bill._id + " updated. New total: " + bill.totalAmount);
        } else {
          console.log("No UNPAID bill found. Creating new bill for customer " + userDoc.name);
          // Create new bill
          const orderSubtotal = updatedOrder.total || updatedOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const newBill = new Bill({
            customerId: userDoc._id,
            customerName: userDoc.name,
            customerEmail: userDoc.email,
            orderIds: [updatedOrder._id],
            items: billItems,
            subtotal: orderSubtotal,
            totalAmount: orderSubtotal,
            status: "UNPAID",
          });
          await newBill.save();
          console.log("New bill created: " + newBill._id + " for " + newBill.totalAmount);
        }
      } else {
        // Guest order - check for existing unpaid bill by email or name
        console.log("Guest order - checking for existing bill for order " + updatedOrder._id);
        console.log("Customer info:", updatedOrder.customer);
        
        // Try to get customer info from the order (if stored)
        const customerName = updatedOrder.customer?.name || 'Guest Customer';
        const customerEmail = updatedOrder.customer?.email || '';
        const customerPhone = updatedOrder.customer?.phone || '';
        const tableNumber = updatedOrder.tableNumber || '';
        
        console.log("Looking for existing unpaid bill with:", { customerName, customerEmail, tableNumber });
        
        // Try to find existing unpaid bill - first by email
        let existingBill = null;
        
        if (customerEmail) {
          existingBill = await Bill.findOne({
            customerEmail: customerEmail,
            status: "UNPAID",
          });
          console.log("Search by email result:", existingBill ? existingBill._id : 'None found');
        }
        
        // If not found by email, try by name + table
        if (!existingBill && customerName && tableNumber) {
          existingBill = await Bill.findOne({
            customerName: customerName,
            tableNumber: tableNumber,
            status: "UNPAID",
          });
          console.log("Search by name+table result:", existingBill ? existingBill._id : 'None found');
        }
        
        // If still not found, try just by name
        if (!existingBill && customerName) {
          existingBill = await Bill.findOne({
            customerName: customerName,
            status: "UNPAID",
          });
          console.log("Search by name result:", existingBill ? existingBill._id : 'None found');
        }
        
        if (existingBill) {
          console.log("Found existing UNPAID bill " + existingBill._id + ". Appending " + billItems.length + " items.");
          // Append items and recalculate total
          existingBill.items.push(...billItems);
          const subtotal = existingBill.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );
          existingBill.subtotal = subtotal;
          existingBill.totalAmount = subtotal;
          // Add order to orderIds array if not already there
          if (existingBill.orderIds && !existingBill.orderIds.includes(updatedOrder._id)) {
            existingBill.orderIds.push(updatedOrder._id);
          }
          await existingBill.save();
          console.log("Bill " + existingBill._id + " updated. New total: " + existingBill.totalAmount);
        } else {
          console.log("No UNPAID bill found. Creating new bill for guest " + customerName);
          // Create new bill for guest
          const orderSubtotal = updatedOrder.total || updatedOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const newBill = new Bill({
            customerName: customerName,
            customerEmail: customerEmail,
            customerPhone: customerPhone,
            tableNumber: tableNumber,
            orderIds: [updatedOrder._id],
            items: billItems,
            subtotal: orderSubtotal,
            totalAmount: orderSubtotal,
            status: "UNPAID",
          });
          await newBill.save();
          console.log("New guest bill created: " + newBill._id + " for " + newBill.totalAmount);
        }
      }

      // Mark order as billed
      await Order.findByIdAndUpdate(updatedOrder._id, { isBilled: true });
      console.log("Order " + updatedOrder._id + " marked as isBilled: true");
    } else {
      console.log("No billing needed. Status:", status, ", isBilled:", updatedOrder.isBilled);
    }

    res.json({ message: "Order status updated", order: updatedOrder });
  } catch (error) {
    console.error("Error updating order:", error);
    res
      .status(500)
      .json({ message: "Error updating order", error: error.message });
  }
};

// Generate bills for all completed orders that are not billed
exports.generateBillsForCompletedOrders = async (req, res) => {
  try {
    console.log("=== GENERATING BILLS FOR COMPLETED ORDERS ===");
    
    // Find all completed orders that are not billed
    const completedOrders = await Order.find({
      orderStatus: { $in: ["COMPLETED", "DELIVERED"] },
      isBilled: false
    }).populate("user", "name email");
    
    console.log(`Found ${completedOrders.length} completed orders without bills`);
    
    let billsCreated = 0;
    let billsUpdated = 0;
    
    for (const order of completedOrders) {
      console.log(`\nProcessing order: ${order._id}, Status: ${order.orderStatus}, isBilled: ${order.isBilled}`);
      
      const billItems = order.items.map((item) => ({
        productId: item.menuItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      const customerName = order.customer?.name || order.user?.name || 'Guest Customer';
      const customerEmail = order.customer?.email || order.user?.email || '';
      const customerPhone = order.customer?.phone || '';
      const tableNumber = order.tableNumber || '';
      
      if (order.user) {
        // Registered user - find or create bill with customerId
        const userDoc = order.user;
        let bill = await Bill.findOne({
          customerId: userDoc._id,
          status: "UNPAID",
        });

        if (bill) {
          console.log("Found existing UNPAID bill. Appending items.");
          bill.items.push(...billItems);
          const subtotal = bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          bill.subtotal = subtotal;
          bill.totalAmount = subtotal;
          if (bill.orderIds && !bill.orderIds.includes(order._id)) {
            bill.orderIds.push(order._id);
          }
          await bill.save();
          billsUpdated++;
        } else {
          console.log("Creating new bill for customer");
          const orderSubtotal = order.total || order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const newBill = new Bill({
            customerId: userDoc._id,
            customerName: userDoc.name,
            customerEmail: userDoc.email,
            orderIds: [order._id],
            items: billItems,
            subtotal: orderSubtotal,
            totalAmount: orderSubtotal,
            status: "UNPAID",
          });
          await newBill.save();
          billsCreated++;
        }
      } else {
        // Guest order
        let existingBill = null;
        
        if (customerEmail) {
          existingBill = await Bill.findOne({
            customerEmail: customerEmail,
            status: "UNPAID",
          });
        }
        
        if (!existingBill && customerName && tableNumber) {
          existingBill = await Bill.findOne({
            customerName: customerName,
            tableNumber: tableNumber,
            status: "UNPAID",
          });
        }
        
        if (!existingBill && customerName) {
          existingBill = await Bill.findOne({
            customerName: customerName,
            status: "UNPAID",
          });
        }
        
        if (existingBill) {
          console.log("Found existing UNPAID bill for guest. Appending items.");
          existingBill.items.push(...billItems);
          const subtotal = existingBill.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          existingBill.subtotal = subtotal;
          existingBill.totalAmount = subtotal;
          if (existingBill.orderIds && !existingBill.orderIds.includes(order._id)) {
            existingBill.orderIds.push(order._id);
          }
          await existingBill.save();
          billsUpdated++;
        } else {
          console.log("Creating new bill for guest");
          const orderSubtotal = order.total || order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const newBill = new Bill({
            customerName: customerName,
            customerEmail: customerEmail,
            customerPhone: customerPhone,
            tableNumber: tableNumber,
            orderIds: [order._id],
            items: billItems,
            subtotal: orderSubtotal,
            totalAmount: orderSubtotal,
            status: "UNPAID",
          });
          await newBill.save();
          billsCreated++;
        }
      }
      
      // Mark order as billed
      await Order.findByIdAndUpdate(order._id, { isBilled: true });
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Bills created: ${billsCreated}`);
    console.log(`Bills updated: ${billsUpdated}`);
    console.log(`Total processed: ${completedOrders.length}`);
    
    res.json({
      message: "Bills generated successfully",
      billsCreated,
      billsUpdated,
      totalProcessed: completedOrders.length
    });
  } catch (error) {
    console.error("Error generating bills:", error);
    res
      .status(500)
      .json({ message: "Error generating bills", error: error.message });
  }
};

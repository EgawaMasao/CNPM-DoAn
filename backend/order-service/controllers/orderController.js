import Order from "../models/orderModel.js";

// @desc Create new order
// @route POST /api/orders
export const createOrder = async (req, res) => {
    try {
        console.log("=== CREATE ORDER DEBUG ===");
        console.log("Request body:", JSON.stringify(req.body, null, 2));
        console.log("User from token:", req.user);
        
        const { customerId, restaurantId, items, deliveryAddress } = req.body;
        
        // Validate required fields
        if (!customerId) {
            console.log("Missing customerId");
            return res.status(400).json({ error: "Customer ID is required" });
        }
        if (!restaurantId) {
            console.log("Missing restaurantId");
            return res.status(400).json({ error: "Restaurant ID is required" });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            console.log("Missing or invalid items:", items);
            return res.status(400).json({ error: "Items are required and must be a non-empty array" });
        }
        if (!deliveryAddress) {
            console.log("Missing deliveryAddress");
            return res.status(400).json({ error: "Delivery address is required" });
        }
        
        // Validate items structure
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.foodId || !item.quantity || !item.price) {
                console.log(`Invalid item at index ${i}:`, item);
                return res.status(400).json({ 
                    error: `Item at index ${i} is missing required fields (foodId, quantity, price)` 
                });
            }
        }
        
        // Calculate totalPrice based on items (quantity * price)
        let totalPrice = 0;
        items.forEach(item => {
            totalPrice += item.quantity * item.price;
        });
        
        console.log("Calculated totalPrice:", totalPrice);
        
        const orderData = {
            customerId,
            restaurantId,
            items,
            totalPrice,
            deliveryAddress
        };
        
        console.log("Creating order with data:", JSON.stringify(orderData, null, 2));
        
        const order = new Order(orderData);
        const savedOrder = await order.save();
        
        console.log("Order created successfully:", savedOrder._id);
        res.status(201).json(savedOrder);
    } catch (error) {
        console.error("Error creating order:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ 
            error: "Server Error", 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// @desc Get all orders
// @route GET /api/orders
export const getOrders = async (req, res) => {
    try {
        const orders = await Order.find();  // No need to populate manually inputted fields
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
};

// @desc Get single order by ID
// @route GET /api/orders/:id
export const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });

        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
};

// @desc Update order details
// @route PATCH /api/orders/:id
export const updateOrderDetails = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Update order details
        const { items, deliveryAddress } = req.body;
        
        // Update only provided fields
        if (items) {
            order.items = items;

            // Recalculate totalPrice based on the new items
            order.totalPrice = 0;
            items.forEach(item => {
                order.totalPrice += item.quantity * item.price;
            });
        }
        if (deliveryAddress) order.deliveryAddress = deliveryAddress;

        await order.save();

        res.status(200).json(order);
    } catch (error) {
        console.error("Error updating order:", error);
        res.status(500).json({ error: "Server Error" });
    }
};

// @desc Update order status
// @route PATCH /api/orders/:id
export const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });

        if (!order) return res.status(404).json({ message: "Order not found" });

        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
};

// @desc Delete (Cancel) order
// @route DELETE /api/orders/:id
export const cancelOrder = async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(req.params.id, { status: "Canceled" }, { new: true });
        if (!order) return res.status(404).json({ message: "Order not found" });

        res.status(200).json({ message: "Order canceled", order });
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
};
 
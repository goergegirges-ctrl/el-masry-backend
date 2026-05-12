import { supabase } from "../config/supabaseClient.js";
import crypto from "crypto";
import validator from "validator";

// Placing user order for frontend
const placeOrder = async (req, res) => {
    try {
        const { userId, customer, items, shippingAddress, subtotal, deliveryFee, paymentMethod } = req.body;

        if (!customer || !items || !shippingAddress) {
            return res.status(400).json({ success: false, message: "Missing required order fields" });
        }
        if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
            return res.status(400).json({ success: false, message: "Invalid items" });
        }
        const { firstName, lastName, email, phone } = customer;
        if (!firstName || !lastName || !email || !phone) {
            return res.status(400).json({ success: false, message: "Missing customer details" });
        }
        if (!validator.isEmail(String(email))) {
            return res.status(400).json({ success: false, message: "Invalid email address" });
        }
        if (!shippingAddress.street || !shippingAddress.city) {
            return res.status(400).json({ success: false, message: "Missing shipping address" });
        }
        for (const item of items) {
            const qty = Number(item.quantity);
            if (!item.productId || !Number.isInteger(qty) || qty < 1 || qty > 999) {
                return res.status(400).json({ success: false, message: "Invalid item quantity" });
            }
        }

        const newOrder = {
            id: crypto.randomUUID(),
            userId: userId || null, // Optional for Guest Checkout
            customer,
            items,
            shippingAddress,
            subtotal: Number(subtotal) || 0,
            deliveryFee: Number(deliveryFee) || 0,
            paymentMethod: paymentMethod || "Cash on Delivery",
            status: "pending"
        };

        const { error } = await supabase.from('orders').insert([newOrder]);
        if (error) throw error;

        // Update stock levels
        for (const item of items) {
            if (!item.productId) continue;
            // Fetch current stock
            const { data: productData, error: fetchErr } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.productId)
                .single();
            
            if (fetchErr || !productData) {
                console.error(`Failed to fetch stock for ${item.productId}`);
                continue;
            }

            const newStock = Math.max(0, productData.stock - (item.quantity || 1));
            
            await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', item.productId);
        }

        // Notify admins of the new order (fire-and-forget — don't block the response)
        const total = (Number(subtotal) || 0) + (Number(deliveryFee) || 0);
        supabase.from('notifications').insert({
            type: 'new_order',
            title: 'New Order / طلب جديد',
            body: `${customer.firstName} ${customer.lastName} — EGP ${total.toLocaleString()} (${items.length} item${items.length !== 1 ? 's' : ''})`,
            payload: { order_id: newOrder.id },
        }).then(({ error: nErr }) => {
            if (nErr) console.error("notification insert error:", nErr);
        });

        res.json({ success: true, message: "Order Placed Successfully", orderId: newOrder.id });
    } catch (error) {
        console.log("Error placing order:", error);
        res.json({ success: false, message: "Error placing order" })
    }
}

// Get user specific orders
const getUserOrders = async (req, res) => {
    try {
        const userId = req.userId; // Set by authUser middleware on req, not req.body
        if (!userId) return res.json({ success: false, message: "User ID required" });

        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .eq('userId', userId)
            .order('createdAt', { ascending: false });

        if (error) throw error;
        
        res.json({ success: true, data: orders || [] });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error fetching user orders" });
    }
}

// Listing all orders for admin
const listOrders = async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .order('createdAt', { ascending: false });

        if (error) throw error;
        
        res.json({ success: true, data: orders || [] });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error" });
    }
}

// Updating order status and delivery fee (admin)
const updateOrder = async (req, res) => {
    try {
        const { id, status, deliveryFee } = req.body;
        if (!id) return res.json({ success: false, message: "Order ID required" });

        const updateData = {};
        if (status !== undefined) updateData.status = status;
        if (deliveryFee !== undefined) updateData.deliveryFee = Number(deliveryFee);

        const { error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;
        
        // Restore stock if cancelled
        if (status === 'cancelled') {
            const { data: orderData, error: fetchErr } = await supabase
                .from('orders')
                .select('items')
                .eq('id', id)
                .single();
                
            if (!fetchErr && orderData && orderData.items) {
                for (const item of orderData.items) {
                    if (!item.productId) continue;
                    
                    const { data: prodData, error: prodErr } = await supabase
                        .from('products')
                        .select('stock')
                        .eq('id', item.productId)
                        .single();
                        
                    if (!prodErr && prodData) {
                        const restoredStock = prodData.stock + (item.quantity || 1);
                        await supabase
                            .from('products')
                            .update({ stock: restoredStock })
                            .eq('id', item.productId);
                    }
                }
            }
        }

        res.json({ success: true, message: "Order Updated" });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error" });
    }
}

// Get dashboard stats with growth analytics
const getDashboardStats = async (req, res) => {
    try {
        // Fetch all orders and products due to lack of complex aggregate RPCs out of the box
        const { data: allOrders, error: ordersErr } = await supabase.from('orders').select('subtotal, status, createdAt');
        if (ordersErr) throw ordersErr;

        const { data: allProducts, error: prodErr } = await supabase.from('products').select('id, stock, name, category, images');
        if (prodErr) throw prodErr;

        const orders = allOrders || [];
        const products = allProducts || [];

        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.status === "pending").length;
        const totalProducts = products.length;
        const lowStockProducts = products.filter(p => p.stock < 5);

        // Total Revenue
        const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0);

        // Sales Growth Calculation (Last 30 days vs Previous 30 days)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

        const recentOrders = orders.filter(o => new Date(o.createdAt) >= thirtyDaysAgo);
        const previousOrders = orders.filter(o => {
            const date = new Date(o.createdAt);
            return date >= sixtyDaysAgo && date < thirtyDaysAgo;
        });

        const recentTotal = recentOrders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0);
        const previousTotal = previousOrders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0);

        let growthRate = 0;
        if (previousTotal > 0) {
            growthRate = ((recentTotal - previousTotal) / previousTotal) * 100;
        } else if (recentTotal > 0) {
            growthRate = 100;
        }

        res.json({
            success: true,
            stats: {
                totalOrders,
                pendingOrders,
                totalProducts,
                totalRevenue,
                growthRate: growthRate.toFixed(2),
                recentSales: recentTotal,
                previousSales: previousTotal,
                lowStockCount: lowStockProducts.length,
                lowStockItems: lowStockProducts
            }
        });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error fetching dashboard stats" });
    }
}

// List all unique customers with stats
const listCustomers = async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('customer, subtotal, createdAt');
            
        if (error) throw error;

        // Perform group by in memory
        const customerMap = {};
        
        for (const order of (orders || [])) {
            if (!order.customer || !order.customer.email) continue;
            const email = order.customer.email;
            
            if (!customerMap[email]) {
                customerMap[email] = {
                    id: email,
                    firstName: order.customer.firstName,
                    lastName: order.customer.lastName,
                    phone: order.customer.phone,
                    city: order.customer.city,
                    address: order.customer.address,
                    orderCount: 0,
                    totalSpent: 0,
                    lastOrderDate: order.createdAt
                };
            }
            
            customerMap[email].orderCount += 1;
            customerMap[email].totalSpent += (Number(order.subtotal) || 0);
            
            if (new Date(order.createdAt) > new Date(customerMap[email].lastOrderDate)) {
                customerMap[email].lastOrderDate = order.createdAt;
            }
        }

        const customers = Object.values(customerMap).sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate));
        res.json({ success: true, data: customers });
    } catch (error) {
        console.error("List Customers Error:", error);
        res.status(500).json({ success: false, message: "Error fetching customers" });
    }
}

const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.json({ success: false, message: "Order ID required" });

        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // IDOR guard: regular users may only view their own orders
        if (req.userId && order.userId !== req.userId) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        res.json({ success: true, data: order });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Error fetching order" });
    }
}

export { placeOrder, listOrders, updateOrder, getDashboardStats, listCustomers, getUserOrders, getOrderById };

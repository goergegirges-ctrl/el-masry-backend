import { supabase } from "../config/supabaseClient.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const adminLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: admin, error } = await supabase
            .from('admins')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !admin) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const accessToken = jwt.sign(
            { id: admin.id, email: admin.email, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );
        const refreshToken = jwt.sign(
            { id: admin.id },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            token: accessToken,
            user: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: 'admin'
            }
        });
    } catch (error) {
        console.error("Admin Login Error:", error);
        res.status(500).json({ success: false, message: "Server error during login" });
    }
}

// @desc    Get customer details (Profile + Orders + Wishlist + Stats)
// @route   GET /api/admin/customer/:id
const getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`[getCustomerById] Looking up customer id: "${id}" (type: ${typeof id})`);

        const { data: customer, error: cusError } = await supabase
            .from('users')
            .select('id, firstName, lastName, email, phone, savedAddresses, wishlist, role, createdAt')
            .eq('id', id)
            .single();

        if (cusError) {
            // PGRST116 = PostgREST "no rows returned" — not a server error
            const isNotFound = cusError.code === 'PGRST116';
            console.error(`[getCustomerById] Supabase error (code: ${cusError.code}):`, cusError.message);
            return res.json({
                success: false,
                message: isNotFound
                    ? `Customer not found (id: ${id})`
                    : `Database error: ${cusError.message}`
            });
        }

        if (!customer) {
            return res.json({ success: false, message: `Customer not found (id: ${id})` });
        }

        const { data: rawOrders } = await supabase
            .from('orders')
            .select('*')
            .eq('userId', id)
            .neq('status', 'cancelled')
            .order('createdAt', { ascending: false });

        const orders = rawOrders || [];

        // Enrich wishlist IDs into full product objects
        const wishlistIds = customer.wishlist || [];
        let wishlistProducts = [];
        if (wishlistIds.length > 0) {
            const { data: products } = await supabase
                .from('products')
                .select('id, name, price, images, stock')
                .in('id', wishlistIds);
            wishlistProducts = products || [];
        }

        // Calculate stats
        const totalOrders = orders.length;
        const totalSpent = orders.reduce((acc, order) => acc + (Number(order.subtotal) || 0), 0);
        const avgOrderValue = totalOrders > 0 ? (totalSpent / totalOrders).toFixed(2) : 0;

        res.json({
            success: true,
            customer,
            orders,
            wishlistProducts,
            stats: {
                totalOrders,
                totalSpent,
                avgOrderValue
            }
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

// @desc    Analytics: Most wishlisted products
const getWishlistPopular = async (req, res) => {
    try {
        const { data: users, error } = await supabase.from('users').select('wishlist');
        if (error) throw error;

        // Map/reduce wishlist occurrences
        const productStats = {};
        for (const user of (users || [])) {
            const wishlist = user.wishlist || [];
            for (const pid of wishlist) {
                if (!productStats[pid]) productStats[pid] = 0;
                productStats[pid]++;
            }
        }

        // Sort top 10
        const sortedPids = Object.keys(productStats)
            .sort((a, b) => productStats[b] - productStats[a])
            .slice(0, 10);

        if (sortedPids.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const { data: products } = await supabase
            .from('products')
            .select('*')
            .in('id', sortedPids);

        // Map final structure
        const data = (products || []).map(p => ({
            id: p.id,
            wishlistCount: productStats[p.id],
            product: p
        })).sort((a, b) => b.wishlistCount - a.wishlistCount);

        res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

// @desc    Analytics: Best selling products
const getBestSellers = async (req, res) => {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('items')
            .neq('status', 'cancelled');
            
        if (error) throw error;

        const productSales = {};
        
        for (const order of (orders || [])) {
            const items = order.items || [];
            for (const item of items) {
                const pid = item.productId;
                if (!pid) continue;
                if (!productSales[pid]) {
                    productSales[pid] = {
                        id: pid,
                        name: item.name,
                        unitsSold: 0,
                        revenueGenerated: 0
                    };
                }
                productSales[pid].unitsSold += (item.quantity || 1);
                productSales[pid].revenueGenerated += (item.quantity || 1) * (item.price || 0);
            }
        }

        // Sort and limit
        const topSelling = Object.values(productSales)
            .sort((a, b) => b.unitsSold - a.unitsSold)
            .slice(0, 10);

        if (topSelling.length === 0) return res.json({ success: true, data: [] });

        const { data: products } = await supabase
            .from('products')
            .select('*')
            .in('id', topSelling.map(s => s.id));

        const data = topSelling.map(s => {
            s.productDetails = (products || []).find(p => p.id === s.id) || null;
            return s;
        });

        res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

// @desc    Analytics: Summary stats
const getAnalyticsSummary = async (req, res) => {
    try {
        // Fetch all orders and products due to lack of complex aggregate RPCs out of the box
        const { data: allOrders, error: ordersErr } = await supabase.from('orders').select('subtotal, status, createdAt');
        if (ordersErr) throw ordersErr;

        const { data: allProducts, error: prodErr } = await supabase.from('products').select('stock');
        if (prodErr) throw prodErr;

        const orders = allOrders || [];
        const products = allProducts || [];

        const totalOrders = orders.length;
        const totalProducts = products.length;
        const lowStockCount = products.filter(p => (Number(p.stock) || 0) < 5).length;

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
            data: {
                totalOrders,
                totalProducts,
                totalRevenue,
                growthRate: growthRate.toFixed(2),
                recentSales: recentTotal,
                previousSales: previousTotal,
                lowStockCount
            }
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

// @desc    Analytics: Sales by category
const getCategoryAnalytics = async (req, res) => {
    try {
        const { data: orders, error: ordersErr } = await supabase
            .from('orders')
            .select('items')
            .neq('status', 'cancelled');
            
        if (ordersErr) throw ordersErr;

        const { data: products, error: prodErr } = await supabase
            .from('products')
            .select('id, category');

        if (prodErr) throw prodErr;

        // Create product to category map
        const prodIdToCategory = {};
        for (const p of (products || [])) {
            prodIdToCategory[p.id] = p.category || "Uncategorized";
        }

        const categorySales = {};
        
        for (const order of (orders || [])) {
            const items = order.items || [];
            for (const item of items) {
                const pid = item.productId;
                if (!pid) continue;
                
                const category = prodIdToCategory[pid] || "Uncategorized";
                const value = (item.quantity || 1) * (item.price || 0);
                
                if (!categorySales[category]) categorySales[category] = 0;
                categorySales[category] += value;
            }
        }

        const data = Object.keys(categorySales).map(cat => ({
            name: cat,
            value: categorySales[cat]
        }));

        res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

// @desc    Analytics: Inventory Alerts (Low/Out of Stock)
const getInventoryAlerts = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .lt('stock', 5)
            .order('stock', { ascending: true });
            
        if (error) throw error;
        
        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
}

const getCustomers = async (req, res) => {
    try {
        const { data: users, error: userErr } = await supabase
            .from('users')
            .select('id, firstName, lastName, email, phone, role, createdAt');
            
        if (userErr) throw userErr;

        const { data: orders, error: orderErr } = await supabase
            .from('orders')
            .select('userId, subtotal, createdAt, status');

        if (orderErr) throw orderErr;

        const customersWithStats = (users || []).map(user => {
            // Find orders for this user
            const userOrders = (orders || [])
                .filter(o => o.userId === user.id && o.status !== 'cancelled')
                .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                
            const totalSpent = userOrders.reduce((sum, order) => sum + (Number(order.subtotal) || 0), 0);
            
            return {
                ...user,
                totalOrders: userOrders.length,
                totalSpent,
                lastOrderDate: userOrders.length > 0 ? userOrders[userOrders.length - 1].createdAt : null
            };
        });

        res.json({ success: true, customers: customersWithStats });
    } catch (error) {
        console.error("Get Customers Error:", error.message);
        res.json({ success: false, message: error.message });
    }
}

// @desc    Dashboard charts: orders-by-status, daily revenue (30d), recent orders, customer stats, avg order value
const getDashboardCharts = async (req, res) => {
    try {
        const [ordersRes, usersRes] = await Promise.all([
            supabase.from('orders').select('id, status, subtotal, createdAt, customer, items'),
            supabase.from('users').select('id, createdAt, role'),
        ]);

        if (ordersRes.error) throw ordersRes.error;

        const orders = ordersRes.data || [];
        const users = usersRes.data || [];

        // Orders by status
        const statusCounts = {};
        for (const o of orders) {
            statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
        }
        const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

        // Daily revenue — last 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const dailyMap = {};
        for (let i = 0; i < 30; i++) {
            const d = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
            dailyMap[d.toISOString().slice(0, 10)] = 0;
        }
        for (const o of orders) {
            const day = new Date(o.createdAt).toISOString().slice(0, 10);
            if (day in dailyMap) dailyMap[day] += Number(o.subtotal) || 0;
        }
        const dailyRevenue = Object.entries(dailyMap)
            .map(([date, revenue]) => ({ date, revenue }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Recent 5 orders
        const recentOrders = [...orders]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5)
            .map(o => ({
                id: o.id,
                customerName: o.customer?.name || o.customer?.firstName || 'Guest',
                status: o.status,
                subtotal: Number(o.subtotal) || 0,
                createdAt: o.createdAt,
            }));

        // Customer stats — this month vs last month
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const thisMonthCustomers = users.filter(u => new Date(u.createdAt) >= startOfThisMonth).length;
        const lastMonthCustomers = users.filter(u => {
            const d = new Date(u.createdAt);
            return d >= startOfLastMonth && d < startOfThisMonth;
        }).length;

        // Avg order value (non-cancelled)
        const validOrders = orders.filter(o => o.status !== 'cancelled');
        const avgOrderValue = validOrders.length > 0
            ? validOrders.reduce((s, o) => s + (Number(o.subtotal) || 0), 0) / validOrders.length
            : 0;

        // Top 5 selling products
        const productSales = {};
        for (const o of orders.filter(ord => ord.status !== 'cancelled')) {
            for (const item of (o.items || [])) {
                const pid = item.productId;
                if (!pid) continue;
                if (!productSales[pid]) productSales[pid] = { id: pid, name: item.name, unitsSold: 0, revenue: 0 };
                productSales[pid].unitsSold += item.quantity || 1;
                productSales[pid].revenue += (item.quantity || 1) * (item.price || 0);
            }
        }
        const topProducts = Object.values(productSales)
            .sort((a, b) => b.unitsSold - a.unitsSold)
            .slice(0, 5);

        res.json({
            success: true,
            data: {
                ordersByStatus,
                dailyRevenue,
                recentOrders,
                customerStats: { thisMonth: thisMonthCustomers, lastMonth: lastMonthCustomers },
                avgOrderValue: Math.round(avgOrderValue),
                topProducts,
            }
        });
    } catch (error) {
        console.error('getDashboardCharts error:', error);
        res.json({ success: false, message: error.message });
    }
};

export {
    adminLogin,
    getCustomers,
    getCustomerById,
    getAnalyticsSummary,
    getWishlistPopular,
    getBestSellers,
    getCategoryAnalytics,
    getInventoryAlerts,
    getDashboardCharts,
};

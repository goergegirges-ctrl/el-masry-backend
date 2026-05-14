import express from "express";
import rateLimit from "express-rate-limit";
import {
    adminLogin,
    getCustomers,
    getCustomerById,
    getAnalyticsSummary,
    getWishlistPopular,
    getBestSellers,
    getCategoryAnalytics,
    getInventoryAlerts,
    getDashboardCharts,
    deleteOrder,
    banUser,
    deleteUser,
} from "../controllers/adminController.js";
import { getDashboardStats, getOrderById } from "../controllers/orderController.js";
import {
    getNotifications,
    markAllRead,
    streamNotifications,
} from "../controllers/notificationController.js";
import authAdmin from "../middlewar/authAdmin.js";

const adminRouter = express.Router();

const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: "Too many login attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});

adminRouter.post("/login", adminLoginLimiter, adminLogin);
adminRouter.get("/dashboard", authAdmin, getDashboardStats);
adminRouter.get("/analytics/summary", authAdmin, getAnalyticsSummary);

// Order detail (admin view — uses authAdmin, not authUser)
adminRouter.get("/order/:id", authAdmin, getOrderById);

// Order management — DELETE only allowed for cancelled orders (enforced in controller)
adminRouter.delete("/order/:id", authAdmin, deleteOrder);

// Customer management
adminRouter.get("/customers", authAdmin, getCustomers);
adminRouter.get("/customer/:id", authAdmin, getCustomerById);
adminRouter.patch("/user/:id/ban", authAdmin, banUser);     // ban / unban
adminRouter.delete("/user/:id", authAdmin, deleteUser);      // only if 0 orders

// Analytics
adminRouter.get("/analytics/wishlist-popular", authAdmin, getWishlistPopular);
adminRouter.get("/analytics/best-sellers", authAdmin, getBestSellers);
adminRouter.get("/analytics/by-category", authAdmin, getCategoryAnalytics);
adminRouter.get("/analytics/inventory-alerts", authAdmin, getInventoryAlerts);
adminRouter.get("/dashboard/charts", authAdmin, getDashboardCharts);

// Notifications
adminRouter.get("/notifications", authAdmin, getNotifications);
adminRouter.patch("/notifications/mark-read", authAdmin, markAllRead);
// SSE stream — auth via ?token= because EventSource can't set headers
adminRouter.get("/notifications/stream", streamNotifications);

export default adminRouter;

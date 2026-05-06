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
} from "../controllers/adminController.js";
import { getDashboardStats, getOrderById } from "../controllers/orderController.js";
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

// Customer Management
adminRouter.get("/customers", authAdmin, getCustomers);
adminRouter.get("/customer/:id", authAdmin, getCustomerById);

// Analytics
adminRouter.get("/analytics/wishlist-popular", authAdmin, getWishlistPopular);
adminRouter.get("/analytics/best-sellers", authAdmin, getBestSellers);
adminRouter.get("/analytics/by-category", authAdmin, getCategoryAnalytics);
adminRouter.get("/analytics/inventory-alerts", authAdmin, getInventoryAlerts);
adminRouter.get("/dashboard/charts", authAdmin, getDashboardCharts);

export default adminRouter;

import express from "express";
import { 
    adminLogin, 
    getCustomers, 
    getCustomerById, 
    getAnalyticsSummary,
    getWishlistPopular, 
    getBestSellers, 
    getCategoryAnalytics, 
    getInventoryAlerts 
} from "../controllers/adminController.js";
import { getDashboardStats } from "../controllers/orderController.js";
import authMiddleware from "../middlewar/auth.js";
import adminAuth from "../middlewar/adminAuth.js";

const adminRouter = express.Router();

adminRouter.post("/login", adminLogin);
adminRouter.get("/dashboard", adminAuth, getDashboardStats);
adminRouter.get("/analytics/summary", adminAuth, getAnalyticsSummary);

// Customer Management
adminRouter.get("/customers", adminAuth, getCustomers);
adminRouter.get("/customer/:id", adminAuth, getCustomerById);

// Analytics
adminRouter.get("/analytics/wishlist-popular", adminAuth, getWishlistPopular);
adminRouter.get("/analytics/best-sellers", adminAuth, getBestSellers);
adminRouter.get("/analytics/by-category", adminAuth, getCategoryAnalytics);
adminRouter.get("/analytics/inventory-alerts", adminAuth, getInventoryAlerts);

export default adminRouter;

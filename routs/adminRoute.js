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
import authAdmin from "../middlewar/authAdmin.js";

const adminRouter = express.Router();

adminRouter.post("/login", adminLogin);
adminRouter.get("/dashboard", authAdmin, getDashboardStats);
adminRouter.get("/analytics/summary", authAdmin, getAnalyticsSummary);

// Customer Management
adminRouter.get("/customers", authAdmin, getCustomers);
adminRouter.get("/customer/:id", authAdmin, getCustomerById);

// Analytics
adminRouter.get("/analytics/wishlist-popular", authAdmin, getWishlistPopular);
adminRouter.get("/analytics/best-sellers", authAdmin, getBestSellers);
adminRouter.get("/analytics/by-category", authAdmin, getCategoryAnalytics);
adminRouter.get("/analytics/inventory-alerts", authAdmin, getInventoryAlerts);

export default adminRouter;

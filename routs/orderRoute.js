import express from "express"
import { placeOrder, listOrders, updateOrder, getDashboardStats, listCustomers, getUserOrders, getOrderById } from "../controllers/orderController.js"
import { authMiddleware, optionalAuth } from "../middlewar/auth.js";

const orderRouter = express.Router();

orderRouter.post("/create", optionalAuth, placeOrder);
orderRouter.get("/userorders", authMiddleware, getUserOrders);
orderRouter.get("/list", authMiddleware, listOrders);
orderRouter.get("/customers", authMiddleware, listCustomers);
orderRouter.get("/dashboard", authMiddleware, getDashboardStats);
orderRouter.get("/:id", authMiddleware, getOrderById);
orderRouter.put("/update", authMiddleware, updateOrder);

export default orderRouter;

import express from "express"
import { placeOrder, listOrders, updateOrder, getDashboardStats, listCustomers, getUserOrders, getOrderById } from "../controllers/orderController.js"
import { optionalAuth } from "../middlewar/auth.js";
import authAdmin from "../middlewar/authAdmin.js";
import authUser from "../middlewar/authUser.js";

const orderRouter = express.Router();

orderRouter.post("/create", optionalAuth, placeOrder);
orderRouter.get("/userorders", authUser, getUserOrders);
orderRouter.get("/list", authAdmin, listOrders);
orderRouter.get("/customers", authAdmin, listCustomers);
orderRouter.get("/dashboard", authAdmin, getDashboardStats);
orderRouter.get("/:id", authUser, getOrderById); // Standard users view their own orders; admin check handled in controller or via separate route if needed
orderRouter.put("/update", authAdmin, updateOrder);

export default orderRouter;

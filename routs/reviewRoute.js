import express from "express";
import { addReview, getProductReviews } from "../controllers/reviewController.js";
import { authMiddleware } from "../middlewar/auth.js";

const reviewRouter = express.Router();

reviewRouter.post("/add", authMiddleware, addReview);
reviewRouter.get("/:productId", getProductReviews);

export default reviewRouter;

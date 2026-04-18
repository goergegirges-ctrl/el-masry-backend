import express from "express";
import { addReview, getProductReviews } from "../controllers/reviewController.js";
import authUser from "../middlewar/authUser.js";

const reviewRouter = express.Router();

reviewRouter.post("/add", authUser, addReview);
reviewRouter.get("/:productId", getProductReviews);

export default reviewRouter;

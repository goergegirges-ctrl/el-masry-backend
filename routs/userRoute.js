import express from "express";

import { registerUser, loginUser, getProfile, toggleWishlist, syncWishlist, updateProfile } from "../controllers/userController.js";
import authMiddleware from "../middlewar/auth.js";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.get("/profile", authMiddleware, getProfile);
userRouter.put("/profile", authMiddleware, updateProfile);
userRouter.post("/wishlist", authMiddleware, toggleWishlist);
userRouter.post("/sync-wishlist", authMiddleware, syncWishlist);

export default userRouter;

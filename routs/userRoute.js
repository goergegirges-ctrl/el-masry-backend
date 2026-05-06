import express from "express";
import rateLimit from "express-rate-limit";
import { registerUser, loginUser, getProfile, toggleWishlist, syncWishlist, updateProfile, refreshToken, oauthLogin } from "../controllers/userController.js";
import authUser from "../middlewar/authUser.js";

const userRouter = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: "Too many login attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});

userRouter.post("/register", registerUser);
userRouter.post("/login", loginLimiter, loginUser);
userRouter.post("/oauth-login", oauthLogin);
userRouter.get("/refresh", refreshToken);
userRouter.get("/profile", authUser, getProfile);
userRouter.put("/profile", authUser, updateProfile);
userRouter.post("/wishlist", authUser, toggleWishlist);
userRouter.post("/sync-wishlist", authUser, syncWishlist);

export default userRouter;


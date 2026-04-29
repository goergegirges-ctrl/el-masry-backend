import express from "express";

import { registerUser, loginUser, getProfile, toggleWishlist, syncWishlist, updateProfile, refreshToken, oauthLogin } from "../controllers/userController.js";
import authUser from "../middlewar/authUser.js";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/oauth-login", oauthLogin);
userRouter.get("/refresh", refreshToken);
userRouter.get("/profile", authUser, getProfile);
userRouter.put("/profile", authUser, updateProfile);
userRouter.post("/wishlist", authUser, toggleWishlist);
userRouter.post("/sync-wishlist", authUser, syncWishlist);

export default userRouter;


import { supabase } from "../config/supabaseClient.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import crypto from "crypto";

// Helper function to create access token (short lived)
const createAccessToken = (id, role = 'user') => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

// Helper function to create refresh token (long lived)
const createRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
}

// @desc    Register new user
// @route   POST /api/users/register
const registerUser = async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    try {
        // Validation
        if (!firstName || !lastName || !email || !password) {
            return res.json({ success: false, message: "Missing required fields" });
        }

        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" });
        }

        if (password.length < 8) {
            return res.json({ success: false, message: "Password must be at least 8 characters" });
        }

        // Check if user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.json({ success: false, message: "User already exists" });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const newUser = {
            id: crypto.randomUUID(),
            firstName,
            lastName,
            email,
            password: hashedPassword,
            wishlist: []
        };

        const { data: user, error } = await supabase
            .from('users')
            .insert([newUser])
            .select()
            .single();

        if (error) throw error;

        const accessToken = createAccessToken(newUser.id, 'user');
        const refreshToken = createRefreshToken(newUser.id);

        // Set refresh token in HTTPOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            success: true, 
            token: accessToken, // Frontend receives access token
            user: {
                id: newUser.id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email,
                role: 'user'
            }
        });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// @desc    Login user
// @route   POST /api/users/login
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.json({ success: false, message: "User doesn't exist" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            const accessToken = createAccessToken(user.id, user.role || 'user');
            const refreshToken = createRefreshToken(user.id);

            // Set refresh token in HTTPOnly cookie
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            res.json({
                success: true, 
                token: accessToken,
                user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    role: user.role || 'user'
                }
            });
        } else {
            res.json({ success: false, message: "Invalid credentials" });
        }

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// @desc    Get user profile
// @route   GET /api/users/profile
const getProfile = async (req, res) => {
    try {
        const { userId } = req.body; // Set by auth middleware
        
        const { data: user, error } = await supabase
            .from('users')
            .select('id, firstName, lastName, email, phone, savedAddresses, wishlist, role, createdAt')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.json({ success: false, message: "User not found" });
        }

        res.json({ success: true, user });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// @desc    Add/Remove from wishlist
// @route   POST /api/users/wishlist
const toggleWishlist = async (req, res) => {
    try {
        const { userId, productId } = req.body;
        
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('wishlist')
            .eq('id', userId)
            .single();
            
        if (fetchError || !user) throw fetchError || new Error("User not found");

        const currentWishlist = user.wishlist || [];
        const isWishlisted = currentWishlist.includes(productId);
        
        let newWishlist;
        if (isWishlisted) {
            newWishlist = currentWishlist.filter(id => id.toString() !== productId);
        } else {
            newWishlist = [...currentWishlist, productId];
        }

        const { error: updateError } = await supabase
            .from('users')
            .update({ wishlist: newWishlist })
            .eq('id', userId);

        if (updateError) throw updateError;
        
        res.json({ success: true, message: isWishlisted ? "Removed from wishlist" : "Added to wishlist", wishlist: newWishlist });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// @desc    Sync wishlist (Merge local with backend)
// @route   POST /api/users/sync-wishlist
const syncWishlist = async (req, res) => {
    try {
        const { userId, localWishlist } = req.body;
        if (!userId || !Array.isArray(localWishlist)) {
            return res.json({ success: false, message: "Missing required fields" });
        }

        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('wishlist')
            .eq('id', userId)
            .single();
            
        if (fetchError || !user) {
            return res.json({ success: false, message: "User not found" });
        }

        // Merge (Union) both lists
        const backendWishlist = user.wishlist || [];
        const mergedWishlist = [...new Set([...backendWishlist, ...localWishlist])];

        const { error: updateError } = await supabase
            .from('users')
            .update({ wishlist: mergedWishlist })
            .eq('id', userId);
            
        if (updateError) throw updateError;

        res.json({ success: true, message: "Wishlist synced", wishlist: mergedWishlist });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// @desc    Update user profile
// @route   PUT /api/users/profile
const updateProfile = async (req, res) => {
    try {
        const { userId, firstName, lastName, phone } = req.body;
        
        if (!firstName || !lastName) {
            return res.json({ success: false, message: "First name and last name are required" });
        }
        
        const { data: user, error } = await supabase
            .from('users')
            .update({ firstName, lastName, phone })
            .eq('id', userId)
            .select('id, firstName, lastName, email, phone')
            .single();
        
        if (error || !user) {
            return res.json({ success: false, message: "User not found" });
        }
        
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone
            }
        });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// @desc    Refresh access token
// @route   GET /api/users/refresh
const refreshToken = async (req, res) => {
    try {
        const cookies = req.cookies;
        if (!cookies?.refreshToken) {
            return res.status(401).json({ success: false, message: "No refresh token provided" });
        }

        const refreshToken = cookies.refreshToken;

        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
            if (err) return res.status(403).json({ success: false, message: "Invalid refresh token" });

            const { data: admin } = await supabase
                .from('admins')
                .select('id')
                .eq('id', decoded.id)
                .single();

            if (admin) {
                const accessToken = createAccessToken(admin.id, 'admin');
                return res.json({ success: true, token: accessToken });
            }

            const { data: user, error } = await supabase
                .from('users')
                .select('id, role')
                .eq('id', decoded.id)
                .single();

            if (error || !user) {
                return res.status(401).json({ success: false, message: "User not found" });
            }

            const accessToken = createAccessToken(user.id, user.role || 'user');
            res.json({ success: true, token: accessToken });
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// @desc    OAuth login (Google / Facebook via Supabase)
// @route   POST /api/users/oauth-login
const oauthLogin = async (req, res) => {
    const { supabaseUserId, email, firstName, lastName, provider } = req.body;

    try {
        if (!supabaseUserId || !email) {
            return res.json({ success: false, message: 'Missing required OAuth fields' });
        }

        // 1. Try to find existing user by email
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (existingUser) {
            // User exists — return JWT
            const accessToken = createAccessToken(existingUser.id, existingUser.role || 'customer');
            const refreshTokenVal = createRefreshToken(existingUser.id);

            res.cookie('refreshToken', refreshTokenVal, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            return res.json({
                success: true,
                token: accessToken,
                user: {
                    id: existingUser.id,
                    firstName: existingUser.firstName,
                    lastName: existingUser.lastName,
                    email: existingUser.email,
                    role: existingUser.role || 'customer',
                },
            });
        }

        // 2. New OAuth user — insert with Supabase UUID, no password
        const newUser = {
            id: supabaseUserId,
            firstName: firstName || email.split('@')[0],
            lastName: lastName || '',
            email,
            password: null,
            wishlist: [],
            role: 'customer',
        };

        const { data: createdUser, error } = await supabase
            .from('users')
            .insert([newUser])
            .select()
            .single();

        if (error) throw error;

        const accessToken = createAccessToken(createdUser.id, 'customer');
        const refreshTokenVal = createRefreshToken(createdUser.id);

        res.cookie('refreshToken', refreshTokenVal, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.json({
            success: true,
            token: accessToken,
            user: {
                id: createdUser.id,
                firstName: createdUser.firstName,
                lastName: createdUser.lastName,
                email: createdUser.email,
                role: 'customer',
            },
        });
    } catch (error) {
        console.log('oauthLogin error:', error);
        res.json({ success: false, message: error.message });
    }
};

export { registerUser, loginUser, getProfile, toggleWishlist, syncWishlist, updateProfile, refreshToken, oauthLogin };


import { supabase } from "../config/supabaseClient.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import crypto from "crypto";

// Helper function to create token
const createToken = (id, role = 'customer') => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
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

        const token = createToken(newUser.id);

        res.json({
            success: true, token, user: {
                id: newUser.id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email
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
            const token = createToken(user.id);
            res.json({
                success: true, token, user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email
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

export { registerUser, loginUser, getProfile, toggleWishlist, syncWishlist, updateProfile };

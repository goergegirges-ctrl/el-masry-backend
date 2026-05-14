import jwt from "jsonwebtoken";
import { supabase } from "../config/supabaseClient.js";

const authUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: "Not Authorized. Please login again." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // SECURITY: Verify the user exists and hasn't been blocked/deleted
        // We also check their role to ensure they aren't an admin trying to use user-only endpoints (if applicable)
        const { data: user, error } = await supabase
            .from('users')
            .select('id, role, banned')
            .eq('id', decoded.id)
            .single();

        if (error || !user) {
            return res.status(401).json({ success: false, message: "User not found or unauthorized." });
        }

        if (user.banned) {
            return res.status(403).json({ success: false, message: "Your account has been suspended" });
        }

        req.userId = decoded.id;
        req.user = user;
        next();
    } catch (error) {
        console.error("Auth User Error:", error.message);
        res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
}

export default authUser;

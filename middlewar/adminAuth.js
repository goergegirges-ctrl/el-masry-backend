import jwt from "jsonwebtoken";

const adminAuth = async (req, res, next) => {
    try {
        const { token } = req.headers;
        if (!token) {
            return res.json({ success: false, message: "Not Authorized Login Again" });
        }
        const token_decode = jwt.verify(token, process.env.JWT_SECRET);
        
        // Match the decoded role to ensure it's an admin
        // Based on auth.js, admin tokens have role: 'admin'
        if (token_decode.role !== 'admin') {
            return res.json({ success: false, message: "Not Authorized Login Again" });
        }
        
        req.admin = token_decode;
        next();
    } catch (error) {
        console.error("Admin Auth Error:", error.message);
        res.json({ success: false, message: error.message });
    }
}

export default adminAuth;

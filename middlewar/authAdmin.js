import jwt from "jsonwebtoken";

const authAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: "Not Authorized. Please login again." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Access Denied. Admins Only." });
        }

        req.adminId = decoded.id;
        req.admin = { id: decoded.id, email: decoded.email, role: decoded.role };
        req.user = req.admin;
        next();
    } catch (error) {
        console.error("Auth Admin Error:", error.message);
        res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
}

export default authAdmin;

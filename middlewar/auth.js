import jwt from "jsonwebtoken";

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: "Not Authorized. Please login again." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!req.body) req.body = {};

        if (decoded.role === 'admin') {
            req.body.adminId = decoded.id;
            req.admin = decoded;
        } else {
            req.body.userId = decoded.id;
            req.user = decoded;
        }

        next();
    } catch (error) {
        console.error("Auth Middleware Error:", error.message);
        res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
}

const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!req.body) req.body = {};
        if (decoded.role === 'admin') {
            req.body.adminId = decoded.id;
            req.admin = decoded;
        } else {
            req.body.userId = decoded.id;
            req.user = decoded;
        }
        next();
    } catch (error) {
        next(); // Ignore invalid tokens in optional auth
    }
}

export { authMiddleware, optionalAuth };
export default authMiddleware;

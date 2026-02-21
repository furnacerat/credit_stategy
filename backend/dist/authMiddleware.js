import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_one_two_three';
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ ok: false, error: 'missing_auth_header' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ ok: false, error: 'missing_token' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (e) {
        return res.status(401).json({ ok: false, error: 'invalid_token' });
    }
}
//# sourceMappingURL=authMiddleware.js.map
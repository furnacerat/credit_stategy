import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_one_two_three';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
    };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ ok: false, error: 'missing_auth_header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ ok: false, error: 'missing_token' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ ok: false, error: 'invalid_token' });
    }
}

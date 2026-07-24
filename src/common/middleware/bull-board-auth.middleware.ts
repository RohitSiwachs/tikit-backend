import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const ALLOWED_ROLES = ['TIKIT_ADMIN', 'SCHOOL_ADMIN'];

@Injectable()
export class BullBoardAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
      return;
    }

    try {
      const publicKey = (process.env.JWT_PUBLIC_KEY ?? '').replace(
        /\\n/g,
        '\n',
      );
      const payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
      }) as any;

      if (!ALLOWED_ROLES.includes(payload.role)) {
        res.status(403).json({
          statusCode: 403,
          message: 'Forbidden: admin access required',
        });
        return;
      }

      next();
    } catch {
      res
        .status(401)
        .json({ statusCode: 401, message: 'Invalid or expired token' });
    }
  }
}

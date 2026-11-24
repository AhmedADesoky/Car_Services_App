import { NextFunction, Request, Response } from 'express';

/** Admin API is reachable only from office / VPN IPs (PLATFORM_ALLOWED_IPS). Empty list = allow (dev only). */
export function ipAllowlist(allowedCsv: string) {
  const allowed = new Set(allowedCsv.split(',').map((ip) => ip.trim()).filter(Boolean));
  return (req: Request, res: Response, next: NextFunction): void => {
    if (allowed.size === 0) return next();
    const ip = (req.ip ?? '').replace(/^::ffff:/, '');
    if (allowed.has(ip)) return next();
    res.status(403).type('application/problem+json').json({ status: 403, code: 'IP_NOT_ALLOWED', title: 'FORBIDDEN', detail: 'Not allowed' });
  };
}

import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';

export function getUploadsDir(): string {
  if (process.env.VERCEL) {
    return '/tmp/uploads';
  }
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
}

export function configureApp(app: INestApplication): void {
  // Body parser limits for base64 photo audits, avatar uploads, and QR code scans (50MB)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.enableCors({
    origin: (_origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma',
      'Expires',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
  });

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires',
    );
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Redirect root / to client frontend only in standalone server mode (not on unified Vercel)
  if (!process.env.VERCEL) {
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.path === '/' || req.path === '') {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(frontendUrl);
      }
      next();
    });
  }

  app.setGlobalPrefix('api');

  // Prevent stale dynamic HTTP caching across all API endpoints
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Serve uploaded move-in / move-out images statically with explicit CORS & CORP headers
  const uploadsPath = getUploadsDir();
  try {
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }
  } catch {}
  app.use(
    '/uploads',
    express.static(uploadsPath, {
      setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );
}

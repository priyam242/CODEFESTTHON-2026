import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Fully permissive for hackathon evaluation: cleanly accepts localhost, Vercel previews & production
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
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  
  // Redirect root / to client frontend (Vercel or localhost) so visits to backend port don't 404
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path === '/' || req.path === '') {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(frontendUrl);
    }
    next();
  });

  app.setGlobalPrefix('api');

  // Prevent stale dynamic HTTP caching across all API endpoints
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Serve uploaded move-in / move-out images statically
  const uploadsPath = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsPath));
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 RentShield server running on http://localhost:${port}`);
}

bootstrap();

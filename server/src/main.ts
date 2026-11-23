import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow localhost, 127.0.0.1, Vercel deployments, or mobile/curl with no origin
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in hackathon/demo mode to prevent CORS blockers
      }
    },
    credentials: true,
  });
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  
  // Redirect root / to client frontend (http://localhost:5173) so browser visits to :4000 don't 404
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path === '/' || req.path === '') {
      return res.redirect('http://localhost:5173');
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

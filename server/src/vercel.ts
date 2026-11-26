import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

let cachedServer: express.Express | null = null;
let initPromise: Promise<express.Express> | null = null;

async function getServer(): Promise<express.Express> {
  if (cachedServer) return cachedServer;
  if (!initPromise) {
    initPromise = (async () => {
      const expressApp = express();
      const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
      configureApp(app);
      await app.init();
      cachedServer = expressApp;
      return expressApp;
    })();
  }
  return initPromise;
}

export default async function handler(req: any, res: any) {
  const server = await getServer();
  return server(req, res);
}

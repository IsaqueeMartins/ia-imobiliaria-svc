import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

type NodeRequestHandler = (request: Request, response: Response) => void;

let handlerPromise: Promise<NodeRequestHandler> | null = null;

async function createHandler(): Promise<NodeRequestHandler> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), { logger: false });

  configureApp(app);
  await app.init();

  return app.getHttpAdapter().getInstance() as NodeRequestHandler;
}

export default async function serverlessHandler(
  request: Request,
  response: Response,
): Promise<void> {
  handlerPromise ??= createHandler();
  const handler = await handlerPromise;
  handler(request, response);
}

export type { INestApplication };

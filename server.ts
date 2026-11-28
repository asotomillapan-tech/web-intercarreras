import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createApiApp } from './api/index.ts';
import {
  injectOpenGraphMetadata,
  resolvePublicOrigin,
  resolveServerSeoMetadata,
} from './api/seoMeta.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = createApiApp();

  if (!IS_PRODUCTION) {
    // Dynamic import keeps Vite out of production runtime dependency path
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api/')) {
        next();
        return;
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        const origin = resolvePublicOrigin({
          envAppUrl: process.env.APP_URL,
          protocol: (req.headers['x-forwarded-proto'] as string | undefined) || req.protocol,
          host: (req.headers['x-forwarded-host'] as string | undefined) || req.get('host'),
        });
        const meta = await resolveServerSeoMetadata(req.originalUrl, origin);
        const html = injectOpenGraphMetadata(template, meta);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtmlPath = path.join(distDir, 'index.html');
    const baseIndexHtml = fs.existsSync(indexHtmlPath)
      ? fs.readFileSync(indexHtmlPath, 'utf-8')
      : '';

    app.use(express.static(distDir, { maxAge: '1h', index: false }));
    app.get('*', async (req, res) => {
      if (!baseIndexHtml) {
        res.sendFile(indexHtmlPath);
        return;
      }
      const origin = resolvePublicOrigin({
        envAppUrl: process.env.APP_URL,
        protocol: (req.headers['x-forwarded-proto'] as string | undefined) || req.protocol,
        host: (req.headers['x-forwarded-host'] as string | undefined) || req.get('host'),
      });
      const meta = await resolveServerSeoMetadata(req.originalUrl, origin);
      const html = injectOpenGraphMetadata(baseIndexHtml, meta);
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Campeonato Intercarreras UFRO server listening on http://0.0.0.0:${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`
    );
  });
}

startServer();

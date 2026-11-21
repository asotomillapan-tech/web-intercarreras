import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createApiApp } from './api/index.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = createApiApp();

  if (!IS_PRODUCTION) {
    // Dynamic import keeps Vite out of production runtime dependency path
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Campeonato Intercarreras UFRO server listening on http://0.0.0.0:${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`
    );
  });
}

startServer();

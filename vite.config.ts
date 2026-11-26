// 개발 서버: 화면(Vite)과 API(server/app.ts)를 한 주소에서 함께 띄운다.
// 운영에서는 같은 server/app.ts 를 Cloudflare Pages Functions(functions/api)가 부른다.
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { IncomingMessage } from 'node:http';
import packageJson from './package.json';

const API_PREFIX = '/api/';

function readBodyAsync(req: IncomingMessage): Promise<Buffer>
{
    return new Promise((resolve, reject) =>
    {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) =>
        {
            chunks.push(chunk);
        });
        req.on('end', () =>
        {
            resolve(Buffer.concat(chunks));
        });
        req.on('error', reject);
    });
}

function poomApiPlugin(): Plugin
{
    return {
        name: 'poom-api',
        configureServer(server)
        {
            server.middlewares.use(async (req, res, next) =>
            {
                if (!req.url || !req.url.startsWith(API_PREFIX))
                {
                    next();
                    return;
                }
                const { handleAsync } = await server.ssrLoadModule('/server/app.ts');
                const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : new Uint8Array(await readBodyAsync(req));
                const headers = new Headers();
                for (const [key, value] of Object.entries(req.headers))
                {
                    if (typeof value === 'string')
                    {
                        headers.set(key, value);
                    }
                }
                const request = new Request('http://localhost' + req.url, { method: req.method, headers, body });
                const response: Response = await handleAsync(request, { USE_MOCK: 'true', ADMIN_KEY: process.env.ADMIN_KEY });
                res.statusCode = response.status;
                response.headers.forEach((value, key) =>
                {
                    res.setHeader(key, value);
                });
                res.end(Buffer.from(await response.arrayBuffer()));
            });
        },
    };
}

const channel = process.env.BUILD_CHANNEL ?? 'test';

export default defineConfig({
    plugins: [react(), poomApiPlugin()],
    define: {
        __APP_VERSION__: JSON.stringify(packageJson.version),
        __APP_CHANNEL__: JSON.stringify(channel),
        __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
    },
});

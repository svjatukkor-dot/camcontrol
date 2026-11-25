import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';

interface BufferedSignal {
  type: 'offer' | 'answer' | 'ice' | 'control';
  payload: unknown;
}

interface PairingRoom {
  code: string;
  hostToken: string;
  phoneToken: string | null;
  phoneName: string;
  createdAt: number;
  lastActivityAt: number;
  hostClients: Set<Response>;
  phoneClients: Set<Response>;
  pendingForHost: BufferedSignal[];
  pendingForPhone: BufferedSignal[];
}

const PORT = Number(process.env.PORT || 3000);
const ROOM_TTL_MS = 15 * 60 * 1000;
const MAX_ROOMS = 200;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const rooms = new Map<string, PairingRoom>();

function generatePairingCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

function safeTokenEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function extractToken(req: Request): string {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  if (typeof req.query.token === 'string') {
    return req.query.token.trim();
  }
  return '';
}

function writeSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function cleanupExpiredRooms(): void {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivityAt > ROOM_TTL_MS) {
      for (const client of room.hostClients) client.end();
      for (const client of room.phoneClients) client.end();
      rooms.delete(code);
    }
  }
}

setInterval(cleanupExpiredRooms, 60_000).unref();

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.post('/api/phone-bridge/rooms', (_req: Request, res: Response) => {
    cleanupExpiredRooms();
    if (rooms.size >= MAX_ROOMS) {
      res.status(503).json({
        error: 'Перевищено ліміт активних сесій сполучення. Спробуйте пізніше.',
      });
      return;
    }

    let code = generatePairingCode();
    while (rooms.has(code)) {
      code = generatePairingCode();
    }

    const hostToken = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    const room: PairingRoom = {
      code,
      hostToken,
      phoneToken: null,
      phoneName: 'Смартфон',
      createdAt: now,
      lastActivityAt: now,
      hostClients: new Set(),
      phoneClients: new Set(),
      pendingForHost: [],
      pendingForPhone: [],
    };
    rooms.set(code, room);

    res.status(201).json({
      code,
      hostToken,
      expiresAt: now + ROOM_TTL_MS,
    });
  });

  app.post('/api/phone-bridge/rooms/:code/join', (req: Request, res: Response) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      res.status(400).json({ error: 'Некоректний формат коду підключення.' });
      return;
    }

    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({
        error: 'Сесію не знайдено або її термін дії вичерпано. Згенеруйте новий код на ПК.',
      });
      return;
    }

    const rawName =
      typeof req.body?.deviceName === 'string' ? req.body.deviceName.trim() : '';
    const phoneName = rawName ? rawName.slice(0, 60) : 'Смартфон (Wi-Fi)';

    room.phoneToken = crypto.randomBytes(24).toString('hex');
    room.phoneName = phoneName;
    room.lastActivityAt = Date.now();

    for (const hostClient of room.hostClients) {
      writeSseEvent(hostClient, 'phone-joined', { phoneName });
    }

    res.json({
      code: room.code,
      phoneToken: room.phoneToken,
      phoneName: room.phoneName,
    });
  });

  app.get('/api/phone-bridge/rooms/:code/events', (req: Request, res: Response) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    const role = req.query.role === 'phone' ? 'phone' : 'host';
    const token = extractToken(req);

    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Сесію не знайдено.' });
      return;
    }

    const expectedToken = role === 'host' ? room.hostToken : room.phoneToken;
    if (!expectedToken || !token || !safeTokenEquals(token, expectedToken)) {
      res.status(401).json({ error: 'Недійсний токен сесії.' });
      return;
    }

    room.lastActivityAt = Date.now();

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const targetSet = role === 'host' ? room.hostClients : room.phoneClients;
    targetSet.add(res);

    writeSseEvent(res, 'connected', {
      code: room.code,
      role,
      phoneConnected: room.phoneClients.size > 0,
    });

    const buffered = role === 'host' ? room.pendingForHost : room.pendingForPhone;
    while (buffered.length > 0) {
      const msg = buffered.shift();
      if (msg) {
        writeSseEvent(res, 'signal', msg);
      }
    }

    const heartbeat = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 20_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      targetSet.delete(res);
      if (role === 'phone') {
        for (const hostClient of room.hostClients) {
          writeSseEvent(hostClient, 'peer-disconnected', { role: 'phone' });
        }
      } else {
        for (const phoneClient of room.phoneClients) {
          writeSseEvent(phoneClient, 'peer-disconnected', { role: 'host' });
        }
      }
    });
  });

  app.post('/api/phone-bridge/rooms/:code/signal', (req: Request, res: Response) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    const role = req.body?.role === 'phone' ? 'phone' : 'host';
    const token =
      extractToken(req) ||
      (typeof req.body?.token === 'string' ? req.body.token.trim() : '');
    const signalType = req.body?.type;
    const payload = req.body?.payload;

    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Сесію не знайдено.' });
      return;
    }

    const expectedToken = role === 'host' ? room.hostToken : room.phoneToken;
    if (!expectedToken || !token || !safeTokenEquals(token, expectedToken)) {
      res.status(401).json({ error: 'Недійсний токен сесії.' });
      return;
    }

    if (
      signalType !== 'offer' &&
      signalType !== 'answer' &&
      signalType !== 'ice' &&
      signalType !== 'control'
    ) {
      res.status(400).json({ error: 'Непідтримуваний тип сигналу.' });
      return;
    }

    room.lastActivityAt = Date.now();
    const message: BufferedSignal = { type: signalType, payload };

    const targetSet = role === 'host' ? room.phoneClients : room.hostClients;
    const targetBuffer =
      role === 'host' ? room.pendingForPhone : room.pendingForHost;

    if (targetSet.size > 0) {
      for (const client of targetSet) {
        writeSseEvent(client, 'signal', message);
      }
    } else if (targetBuffer.length < 60) {
      targetBuffer.push(message);
    }

    res.json({ ok: true });
  });

  app.delete('/api/phone-bridge/rooms/:code', (req: Request, res: Response) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    const token = extractToken(req);
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Сесію не знайдено.' });
      return;
    }
    if (!token || !safeTokenEquals(token, room.hostToken)) {
      res.status(401).json({ error: 'Недійсний токен власника сесії.' });
      return;
    }
    for (const client of room.hostClients) client.end();
    for (const client of room.phoneClients) client.end();
    rooms.delete(code);
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*path', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Збірку не знайдено. Виконайте npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CamControl server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();

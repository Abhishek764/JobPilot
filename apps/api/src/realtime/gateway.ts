import type { Server as HttpServer } from 'node:http';

import { verifyToken } from '@clerk/backend';
import type { RealtimeEvent } from '@jobpilot/types';
import { Server, type Socket } from 'socket.io';

import { env } from '../config/env';
import { logger } from '../config/logger';

let io: Server | null = null;

const room = (clerkUserId: string): string => `user:${clerkUserId}`;

const extractToken = (socket: Socket): string | null => {
  const fromAuth = socket.handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;
  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
  return null;
};

/**
 * Attach a Socket.IO server to the HTTP server. Each socket authenticates with
 * a Clerk session token and is placed into a per-user room so domain mutations
 * can be fanned out to every device a user has open.
 */
export const initRealtime = (server: HttpServer): Server => {
  io = new Server(server, {
    path: '/realtime',
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    serveClient: false,
  });

  io.use(async (socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      next(new Error('unauthorized'));
      return;
    }
    try {
      const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
      if (!payload.sub) {
        next(new Error('unauthorized'));
        return;
      }
      socket.data.clerkUserId = payload.sub;
      next();
    } catch (err) {
      logger.debug({ err: String(err) }, 'socket auth failed');
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const clerkUserId = socket.data.clerkUserId as string;
    void socket.join(room(clerkUserId));
    logger.debug({ clerkUserId, socketId: socket.id }, 'realtime connected');
  });

  logger.info('🔌 realtime gateway ready on /realtime');
  return io;
};

/** Fan a domain event out to every socket the given user has connected. */
export const emitToUser = (clerkUserId: string, event: RealtimeEvent, payload: unknown): void => {
  if (!io) return;
  io.to(room(clerkUserId)).emit(event, payload);
};

export const closeRealtime = async (): Promise<void> => {
  if (!io) return;
  await io.close();
  io = null;
};

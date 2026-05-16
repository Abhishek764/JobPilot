import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createClient = (): PrismaClient =>
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? ['error']
        : ['query', 'info', 'warn', 'error'],
  });

export const prisma: PrismaClient = global.__prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

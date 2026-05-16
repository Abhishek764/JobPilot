import { z } from 'zod';

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
});

const ServerEnvSchema = ClientEnvSchema.extend({
  CLERK_SECRET_KEY: z.string().min(1),
});

const isServer = typeof window === 'undefined';

const parsed = (isServer ? ServerEnvSchema : ClientEnvSchema).safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  ...(isServer ? { CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY } : {}),
});

if (!parsed.success) {
  console.error('❌ Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed');
}

export const env = parsed.data;

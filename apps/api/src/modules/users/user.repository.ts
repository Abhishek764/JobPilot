import { prisma, type Prisma, type User } from '@jobpilot/db';

export const userRepository = {
  findByClerkId: (clerkId: string): Promise<User | null> =>
    prisma.user.findUnique({ where: { clerkId } }),

  findById: (id: string): Promise<User | null> => prisma.user.findUnique({ where: { id } }),

  upsertFromClerk: (input: {
    clerkId: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    imageUrl?: string | null;
  }): Promise<User> =>
    prisma.user.upsert({
      where: { clerkId: input.clerkId },
      update: {
        email: input.email,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        imageUrl: input.imageUrl ?? null,
      },
      create: input,
    }),

  updateProfile: (id: string, data: Prisma.UserUpdateInput): Promise<User> =>
    prisma.user.update({ where: { id }, data }),

  completeOnboarding: (id: string, data: Prisma.UserUpdateInput): Promise<User> =>
    prisma.user.update({ where: { id }, data: { ...data, onboardedAt: new Date() } }),

  deleteByClerkId: (clerkId: string): Promise<User> =>
    prisma.user.delete({ where: { clerkId } }),
};

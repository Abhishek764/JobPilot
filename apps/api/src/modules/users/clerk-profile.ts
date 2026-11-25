import { clerkClient } from '@clerk/express';

import { NotFoundError } from '../../shared/errors';

export interface ClerkProfile {
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

/** Read a user's profile straight from Clerk (used when the webhook hasn't synced them yet). */
export const fetchClerkProfile = async (clerkId: string): Promise<ClerkProfile> => {
  const user = await clerkClient.users.getUser(clerkId);
  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;
  if (!email) throw new NotFoundError('Clerk user email');
  return {
    clerkId,
    email,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl || null,
  };
};

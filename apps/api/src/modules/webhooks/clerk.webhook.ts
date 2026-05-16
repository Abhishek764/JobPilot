import { Router, type Request, type Response } from 'express';

import { logger } from '../../config/logger';
import { asyncHandler } from '../../shared/async-handler';
import { userService } from '../users/user.service';

export const clerkWebhookRouter: Router = Router();

interface ClerkEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: { email_address: string }[];
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
  };
}

clerkWebhookRouter.post(
  '/clerk',
  asyncHandler(async (req: Request, res: Response) => {
    const event = req.body as ClerkEvent;
    logger.info({ type: event.type, id: event.data.id }, 'clerk webhook');

    if (event.type === 'user.created' || event.type === 'user.updated') {
      const email = event.data.email_addresses?.[0]?.email_address;
      if (email) {
        await userService.upsertFromClerk({
          clerkId: event.data.id,
          email,
          firstName: event.data.first_name ?? null,
          lastName: event.data.last_name ?? null,
          imageUrl: event.data.image_url ?? null,
        });
      }
    } else if (event.type === 'user.deleted') {
      await userService.deleteByClerkId(event.data.id).catch(() => undefined);
    }

    res.json({ success: true });
  }),
);

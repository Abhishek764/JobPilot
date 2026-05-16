import { OnboardingSchema, UpdateProfileSchema } from '@jobpilot/types/schemas';
import { Router } from 'express';

import { attachUserId, requireAuth } from '../../middleware/auth';
import { hydrateUser } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';

import { userController } from './user.controller';

export const userRouter: Router = Router();

userRouter.use(requireAuth, attachUserId, hydrateUser);

userRouter.get('/me', userController.me);
userRouter.patch('/me', validate(UpdateProfileSchema), userController.updateMe);
userRouter.post('/me/onboard', validate(OnboardingSchema), userController.onboard);

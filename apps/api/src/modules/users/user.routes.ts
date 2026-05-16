import { Router } from 'express';

import { attachUserId, requireAuth } from '../../middleware/auth';

import { userController } from './user.controller';

export const userRouter: Router = Router();

userRouter.get('/me', requireAuth, attachUserId, userController.me);

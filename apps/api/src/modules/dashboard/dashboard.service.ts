import type { DashboardSummary } from '@jobpilot/types';

import { userService } from '../users/user.service';

import { dashboardRepository } from './dashboard.repository';

export const dashboardService = {
  async summary(clerkUserId: string): Promise<DashboardSummary> {
    const user = await userService.getByClerkId(clerkUserId);
    return dashboardRepository.summary(user.id);
  },
};

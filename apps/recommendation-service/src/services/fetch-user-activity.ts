import prisma from '@packages/libs/prisma/index.js';

/** Loads the activity history used by the recommender. */
export async function getUserActivity(userId: string): Promise<unknown[]> {
  const analytics = await prisma.userAnalytics.findUnique({
    where: { userId },
    select: { actions: true },
  });
  return analytics?.actions ?? [];
}

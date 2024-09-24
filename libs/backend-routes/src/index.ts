import { lazyRoutes } from './lib/routes';

import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';

export const routes = Object.entries(lazyRoutes).reduce(
  (acc, [key, value]) => {
    acc[key] = async () => (await value).default;
    return acc;
  },
  {} as Record<
    string,
    () => Promise<
      (req: NextRequest, event: NextFetchEvent) => Promise<NextResponse | void>
    >
  >,
);

export { matchers } from './lib/matchers'

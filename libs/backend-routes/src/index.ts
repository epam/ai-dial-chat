import { routes } from './lib/routes';

import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';

const lazyRoutes = Object.entries(routes).reduce(
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

export default lazyRoutes;

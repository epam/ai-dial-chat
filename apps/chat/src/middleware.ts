import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';

import { routes } from '@epam/ai-dial-backend-routes';
import {
  MiddlewareManager,
  middlewareFactory,
} from '@epam/modulify-middleware';

const middlewares = middlewareFactory(routes);
const middlewareManager = MiddlewareManager.init(middlewares);

export async function middleware(
  req: NextRequest,
  event: NextFetchEvent,
): Promise<NextResponse | undefined> {
  return await middlewareManager.runMiddleware(req, event);
}

export const config = {
  // matcher: middlewareManager.getMatchers(),
  // matcher: matchers,
  matcher: [{ source: '/api/:slug*' }],
};

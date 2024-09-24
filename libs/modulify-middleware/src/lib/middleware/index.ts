import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';

export interface Middleware {
  matcher: string;
  middleware: () => Promise<
    (req: NextRequest, event: NextFetchEvent) => Promise<NextResponse | void>
  >;
}

export const middlewareFactory = (
  routes: Record<
    string,
    () => Promise<
      (req: NextRequest, event: NextFetchEvent) => Promise<NextResponse | void>
    >
  >,
): Middleware[] => {
  const getMiddleware = (matcher: string): Middleware => {
    const middleware = routes[matcher];
    return {
      matcher,
      middleware: () =>
        typeof middleware === 'function'
          ? middleware()
          : Promise.resolve(() => Promise.resolve(undefined)),
    };
  };

  return Object.keys(routes ?? {}).map((key) => getMiddleware(key));
};

export class MiddlewareManager {
  private static instance: MiddlewareManager;
  private middlewareMap: Record<string, Middleware[]> = {};

  private constructor(middlewares: Middleware[]) {
    middlewares.forEach(({ middleware, matcher }) => {
      if (!this.middlewareMap[matcher]) {
        this.middlewareMap[matcher] = [];
      }
      this.middlewareMap[matcher].push({ middleware, matcher });
    });
  }

  public static init(middlewares: Middleware[]): MiddlewareManager {
    if (!MiddlewareManager.instance) {
      MiddlewareManager.instance = new MiddlewareManager(middlewares);
    }
    return MiddlewareManager.instance;
  }

  public getMiddlewareMap() {
    return this.middlewareMap;
  }

  public getMatchers() {
    return Object.keys(this.middlewareMap).map((matcher) => ({
      source: matcher,
    }));
  }

  public async runMiddleware(
    req: NextRequest,
    event: NextFetchEvent,
  ): Promise<NextResponse> {
    const url = req.nextUrl.clone();
    const middlewareMap = this.getMiddlewareMap();
    const middlewares = Object.keys(middlewareMap).reduce(
      (acc: Middleware[], matcher: string) => {
        if (new RegExp(matcher).test(url.pathname)) {
          acc.push(...middlewareMap[matcher]);
        }
        return acc;
      },
      [],
    );

    for (const { middleware } of middlewares) {
      if (typeof middleware === 'function') {
        const res = (await middleware())?.(req, event);

        if (res) {
          return res as Promise<NextResponse>;
        }
      }
    }

    return NextResponse.next();
  }
}

export default MiddlewareManager;

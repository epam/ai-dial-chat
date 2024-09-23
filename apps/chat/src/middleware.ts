// import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';
//
// import routes from '@epam/ai-dial-backend-routes';
// import { MiddlewareManager, middlewareFactory } from '@epam/modulify-toolkit';
//
// const middlewares = middlewareFactory(routes);
// const middlewareManager = MiddlewareManager.init(middlewares);
//
// export async function middleware(
//   req: NextRequest,
//   event: NextFetchEvent,
// ): Promise<NextResponse | undefined> {
//   return await middlewareManager.runMiddleware(req, event);
// }
//
// export const config = {
//
//   matcher: middlewareManager.getMatchers(),
// };

// TODO:
//  0) uncomment above when middleware is needed
//  1) consider using static matchers to solve 'Unsupported node type "CallExpression" at "config.matcher"'
//  2) find a correct way to import jss/react-jss ('../../node_modules/jss/dist/jss.esm.js')
//     to solve Dynamic Code Evaluation (e. g. 'eval', 'new Function', 'WebAssembly.compile') not allowed in Edge Runtime

import { NextResponse } from 'next/server';

export async function middleware(){ return NextResponse.next(); }

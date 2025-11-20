import { NextRouter } from 'next/router';

import { Observable, from, mergeMap } from 'rxjs';

import { AppAction } from '@/src/types/store';

export const navigateAndThen = (
  router: NextRouter,
  to: Parameters<NextRouter['push']>[0],
  after$: Observable<AppAction>,
) => {
  return from(router.push(to, undefined)).pipe(mergeMap(() => after$));
};

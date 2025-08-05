import { concat, filter, forkJoin, of, switchMap } from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { ToolsetService } from '@/src/utils/app/data/toolset-service';

import { AppEpic } from '@/src/types/store';

import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ToolsetActions.init.type),
    filter(() => !ToolsetSelectors.selectInitialized(state$.value)),
    switchMap(() =>
      forkJoin({
        toolsets: ToolsetService.getToolsets(),
      }).pipe(
        switchMap(({ toolsets }) =>
          concat(
            of(ToolsetActions.setToolsets(toolsets)),
            of(ToolsetActions.initFinish()),
          ),
        ),
      ),
    ),
  );

export const ToolsetEpics = combineEpics(initEpic);

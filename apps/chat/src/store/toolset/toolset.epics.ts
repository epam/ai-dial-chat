import { concat, filter, forkJoin, of, switchMap } from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import { ToolsetService } from '@/src/utils/app/data/toolset-service';
import { constructPath } from '@/src/utils/app/file';
import { convertToolsetModelToApi } from '@/src/utils/app/toolsets';
import { ApiUtils } from '@/src/utils/server/api';

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

const createToolsetEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ToolsetActions.createToolset.type),
    switchMap(({ payload }) => {
      const data = convertToolsetModelToApi(payload);
      const path = constructPath(
        BucketService.getBucket(),
        'toolsets',
        ApiUtils.safeEncodeURIComponent(payload.name),
      );

      return ToolsetService.addToolset(data, path).pipe(
        switchMap(() =>
          forkJoin({
            toolset: ToolsetService.getToolsetByPath(path),
          }).pipe(
            switchMap(({ toolset }) => {
              return of(ToolsetActions.setToolsets([toolset]));
            }),
          ),
        ),
      );
    }),
  );

export const ToolsetEpics = combineEpics(initEpic, createToolsetEpic);

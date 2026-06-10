import { EMPTY, catchError, concat, iif, of, switchMap } from 'rxjs';

import { ToolsetService } from '@/src/utils/app/data/toolset-service';
import { parseApiError } from '@/src/utils/app/epics-helpers/common.epic-helpers';
import { translate } from '@/src/utils/app/translation';

import { RootState } from '@/src/types/store';

import { ToolsetSelectors } from '@/src/store/selectors';
import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '@/src/constants/errors';

export const refreshToolset$ = (toolsetId: string, state: RootState) =>
  ToolsetService.getToolsetById(toolsetId).pipe(
    switchMap((toolset) => {
      const shouldUpdateDetails =
        !!ToolsetSelectors.selectToolsetDetails(state);

      if (!toolset) {
        return of(
          UIActions.showErrorToast({
            message: translate(errorsMessages.toolsetGetFailed, {
              name: toolsetId,
            }),
          }),
        );
      }

      return concat(
        of(ToolsetActions.setToolsets([toolset])),
        iif(
          () => shouldUpdateDetails,
          of(ToolsetActions.getToolsetDetailsSuccess(toolset)),
          EMPTY,
        ),
      );
    }),
    catchError((err) => {
      const { traceId } = parseApiError(err);
      return of(
        UIActions.showErrorToast({
          traceId,
          message: translate(errorsMessages.toolsetGetFailed, {
            name: toolsetId,
          }),
        }),
      );
    }),
  );

import { EMPTY, catchError, concat, iif, of, switchMap } from 'rxjs';

import { ToolsetService } from '@/src/utils/app/data/toolset-service';
import { getIdWithoutFeatureType } from '@/src/utils/app/id';
import { translate } from '@/src/utils/app/translation';

import { ToolsetActions } from '@/src/store/toolset/toolset.reducer';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { Routes } from '@/src/constants/routes';

export const refreshToolset$ = (toolsetId: string, route?: string) =>
  ToolsetService.getToolsetByPath(getIdWithoutFeatureType(toolsetId)).pipe(
    switchMap((toolset) => {
      const shouldUpdateDetails = route === Routes.ToolsetEditor;
      return concat(
        of(ToolsetActions.setToolsets([toolset])),
        iif(
          () => shouldUpdateDetails,
          of(ToolsetActions.getToolsetDetailsSuccess(toolset)),
          EMPTY,
        ),
      );
    }),
    catchError(() => {
      return of(UIActions.showErrorToast(translate('Failed to get toolset')));
    }),
  );

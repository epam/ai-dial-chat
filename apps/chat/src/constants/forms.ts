import { translate } from '../utils/app/translation';

import { Translation } from '@/src/types/translation';

export const formErrors = {
  required: translate('common.errors.forms.field_is_required', {
    ns: Translation.Common,
  }),
  notValidUrl: translate('common.errors.forms.url_is_not_correct', {
    ns: Translation.Common,
  }),
};

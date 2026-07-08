import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { AttachmentsI18nKeys } from '../constants/translation-keys';

export const buildNetworkUploadErrorNotification = (
  filenames: string[],
  t: TFunction,
): { title: string; message: ReactNode } => ({
  title: t(AttachmentsI18nKeys.NetworkErrorTitle),
  message: (
    <div className="min-w-0 overflow-hidden">
      <span className="whitespace-pre-line">
        {t(AttachmentsI18nKeys.NetworkErrorMessage)}
      </span>
      <ul className="mt-1 max-w-[508px]">
        {filenames.map((name, i) => (
          <li key={i} className="flex items-center gap-1 overflow-hidden">
            <span className="shrink-0" aria-hidden>
              •
            </span>
            <span className="min-w-0 flex-1 truncate">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  ),
});

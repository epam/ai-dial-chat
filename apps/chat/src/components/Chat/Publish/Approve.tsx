import { useTranslation } from 'next-i18next';

import { Publication } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';

interface Props {
  publication: Publication;
}

export function ApprovePublication({ publication }: Props) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex size-full flex-col items-center p-0 md:px-5 md:pt-5">
      <div className="flex size-full flex-col items-center gap-[1px] rounded 2xl:max-w-[1000px]">
        <div className="flex w-full items-center justify-center rounded-t bg-layer-2 p-4">
          <h4
            data-qa="app-name"
            className="w-full whitespace-pre text-center text-xl font-semibold"
          >
            {publication.url.split('/').slice(-1).shift()}
          </h4>
        </div>
        <div className="flex w-full items-center justify-end gap-2 rounded-t bg-layer-2 p-4">
          <button
            className="button button-secondary"
            onClick={() =>
              dispatch(
                PublicationActions.rejectPublication({
                  url: publication.url,
                }),
              )
            }
          >
            {t('Reject')}
          </button>
          <button
            className="button button-primary"
            onClick={() =>
              dispatch(
                PublicationActions.approvePublication({
                  url: publication.url,
                }),
              )
            }
          >
            {t('Approve')}
          </button>
        </div>
      </div>
    </div>
  );
}

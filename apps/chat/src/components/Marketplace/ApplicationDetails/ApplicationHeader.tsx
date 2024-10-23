import classNames from 'classnames';

import { DialAIEntityModel } from '@/src/types/models';

import { FunctionStatusIndicator } from '@/src/components/Marketplace/FunctionStatusIndicator';

import { ModelIcon } from '../../Chatbar/ModelIcon';
import { ApplicationTopic } from '../ApplicationTopic';

interface Props {
  entity: DialAIEntityModel;
  isMobileView: boolean;
}

export const ApplicationDetailsHeader = ({ entity, isMobileView }: Props) => {
  // const { t } = useTranslation(Translation.Marketplace);

  // const dispatch = useAppDispatch();

  // const contextMenuItems = useMemo(
  //   () => [
  //     {
  //       BrandIcon: IconLink,
  //       text: t('Copy link'),
  //       onClick: () => {
  //         dispatch(UIActions.showInfoToast(t('Link copied')));
  //       },
  //     },
  //     {
  //       BrandIcon: IconBrandFacebook,
  //       text: t('Share via Facebook'),
  //       onClick: () => {
  //         return 'Share via Facebook';
  //       },
  //     },
  //     {
  //       BrandIcon: IconBrandX,
  //       text: t('Share via X'),
  //       onClick: () => {
  //         return 'Share via X';
  //       },
  //     },
  //   ],
  //   [dispatch, t],
  // );

  return (
    <header className="flex gap-2 px-3 py-4 md:gap-4 md:p-6">
      <ModelIcon
        enableShrinking
        isCustomTooltip
        entity={entity}
        entityId={entity.id}
        size={isMobileView ? 48 : 96}
      />
      <div className="mt-4 flex min-w-0 shrink flex-col gap-1 md:gap-3">
        <div className="flex justify-between">
          <div className="flex w-full flex-col gap-2">
            <div
              className={classNames(
                'flex flex-wrap gap-2 overflow-hidden truncate',
                entity.topics?.length ? 'block' : 'hidden',
              )}
            >
              {entity.topics?.map((topic) => (
                <ApplicationTopic key={topic} topic={topic} />
              ))}
            </div>
            <div
              className="flex items-center gap-2 truncate text-lg font-semibold leading-[18px] md:text-xl md:leading-6"
              data-qa="app-name"
            >
              {entity.name}

              <FunctionStatusIndicator entity={entity} />
            </div>
          </div>
          {/* <div className="flex items-center gap-5">
            <Menu
              listClassName="bg-layer-1 !z-[60] w-[290px]"
              placement="bottom-end"
              type="contextMenu"
              data-qa="application-share-type-select"
              trigger={
                <button className="hidden items-center gap-3 text-accent-primary md:flex">
                  <IconShare className="[&_path]:fill-current" size={18} />
                  <span className="font-semibold">{t('Share')}</span>
                </button>
              }
            >
              <div className="divide-y divide-primary">
                <div className="flex items-center gap-2 px-3 py-4">
                  <ModelIcon
                    isCustomTooltip
                    entity={entity}
                    entityId={entity.id}
                    size={24}
                  />
                  <h5 className="text-xl">{entity.name}</h5>
                </div>
                <div>
                  {contextMenuItems.map(({ BrandIcon, text, ...props }) => (
                    <MenuItem
                      key={text}
                      item={
                        <>
                          <BrandIcon size={18} className="text-secondary" />
                          <span>{text}</span>
                        </>
                      }
                      className="flex w-full items-center gap-3 px-3 py-2 hover:bg-accent-primary-alpha"
                      {...props}
                    />
                  ))}
                </div>
              </div>
            </Menu>
            <button
              className="text-secondary hover:text-accent-primary"
              onClick={onClose}
            >
              <IconX size={24} />
            </button>
          </div> */}
        </div>
        {/* <h2 className="text-lg font-semibold leading-[18px] md:text-xl md:leading-6">
          {application.title}
        </h2> */}
      </div>
    </header>
  );
};

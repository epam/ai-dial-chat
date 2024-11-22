import { getModelDescription } from '@/src/utils/app/application';

import { DialAIEntityModel } from '@/src/types/models';

import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';

interface Props {
  entity: DialAIEntityModel;
}

// const calculateTranslateX = (
//   previewImgsCount: number,
//   activeSlide: number,
//   scrollWidth?: number,
//   clientWidth?: number,
// ) => {
//   if (!clientWidth || !scrollWidth) return 'none';

//   const maxSlideIndex = previewImgsCount - 1;
//   const slideWidth = scrollWidth / previewImgsCount;
//   const isLastSlide = activeSlide === maxSlideIndex;

//   const lastSlideTranslateX = scrollWidth - clientWidth;

//   const baseTranslateX = slideWidth * activeSlide;

//   const adjustment = isSmallScreen() ? 0 : slideWidth / 3;

//   const translateX = isLastSlide
//     ? lastSlideTranslateX
//     : Math.max(0, baseTranslateX - adjustment);

//   return `translateX(-${translateX}px)`;
// };

export const ApplicationDetailsContent = ({ entity }: Props) => {
  // const { t } = useTranslation(Translation.Marketplace);

  // const dispatch = useAppDispatch();

  // const { data: session } = useSession();

  // const sliderRef = useRef<HTMLDivElement>(null);

  // const [activeSlide, setActiveSlide] = useState(0);
  // const [fullScreenSlide, setFullScreenSlide] = useState<number>();
  // const [isRate, setIsRate] = useState(false);

  // const swipeHandlers = useMobileSwipe({
  //   onSwipedLeft: () => {
  //     setActiveSlide((slide) =>
  //       slide >= previewImgsCount - 1 ? previewImgsCount - 1 : slide + 1,
  //     );
  //   },
  //   onSwipedRight: () => {
  //     setActiveSlide((slide) => (slide === 0 ? 0 : slide - 1));
  //   },
  // });

  // const previewImgsCount = application.previewImages.length;
  // const totalRating = Object.values(application.rating).reduce(
  //   (totalRating, rating) => totalRating + rating,
  //   0,
  // );
  // const ratingEntries = Object.entries(application.rating);
  // const averageRating = round(
  //   ratingEntries.reduce(
  //     (acc, [rating, count]) => acc + Number(rating) * count,
  //     0,
  //   ) / totalRating,
  //   1,
  // );

  return (
    <div className="divide-y divide-tertiary overflow-auto">
      {!!getModelDescription(entity) && (
        <section className="px-3 py-4 md:p-6">
          <div className="flex flex-col gap-4">
            {/* <div className="relative overflow-hidden">
            <div
              ref={sliderRef}
              className="flex w-full transition duration-1000 ease-out md:gap-3"
              style={{
                transform: calculateTranslateX(
                  previewImgsCount,
                  activeSlide,
                  sliderRef.current?.scrollWidth,
                  sliderRef.current?.clientWidth,
                ),
              }}
            >
              {application.previewImages.map((image, idx) => (
                <div
                  key={image}
                  className="relative h-[221px] w-full shrink-0 md:w-[393px]"
                >
                  <Image
                    {...swipeHandlers}
                    priority
                    onClick={() => setFullScreenSlide(idx)}
                    src={image}
                    alt={t('application preview')}
                    fill
                    className="cursor-pointer object-cover"
                    sizes="(max-width: 768px) 393px"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                setActiveSlide((slide) => (!slide ? 0 : slide - 1))
              }
              className={classNames(
                'absolute start-0 top-0 h-full w-[100px] items-center justify-center bg-gradient-to-r from-blackout transition duration-500',
                activeSlide !== 0 ? 'opacity-100' : 'cursor-default opacity-0',
              )}
            >
              <IconChevronLeft className="text-secondary" size={30} />
            </button>
            <button
              onClick={() =>
                setActiveSlide((slide) =>
                  slide >= previewImgsCount - 1
                    ? previewImgsCount - 1
                    : slide + 1,
                )
              }
              className={classNames(
                'absolute end-0 top-0 flex h-full w-[100px] items-center justify-end bg-gradient-to-l from-blackout transition duration-500',
                activeSlide !== previewImgsCount - 1
                  ? 'opacity-100'
                  : 'cursor-default opacity-0',
              )}
            >
              <IconChevronRight className="text-secondary" size={30} />
            </button>
          </div> */}
            <EntityMarkdownDescription className="!text-sm !leading-[21px]">
              {getModelDescription(entity) ?? ''}
            </EntityMarkdownDescription>
          </div>
        </section>
      )}
      {/* <section className="px-3 py-4 md:p-6">
        <h3 className="text-lg font-semibold">{t('Capabilities')}</h3>
        <ul className="mt-5 flex list-none flex-col gap-4">
          {application.capabilities.map((capability) => (
            <li key={capability} className="flex items-center gap-2">
              <IconCheck size={18} className="text-success" />
              <p>{capability}</p>
            </li>
          ))}
        </ul>
      </section> */}
      {/* <section className="px-3 py-4 md:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('Rating')}</h3>
          <button
            onClick={() => setIsRate(true)}
            className={classNames(
              'items-center gap-3 text-accent-primary',
              isRate ? 'hidden' : 'flex',
            )}
          >
            <IconMessageStar size={18} />
            <span>{t('Rate')}</span>
          </button>
        </div>
        {!isRate ? (
          <div className="mt-5 flex items-center gap-8">
            <div className="flex flex-col items-center gap-4">
              <h4 className="text-5xl font-semibold">{averageRating}</h4>
              <div className="flex">
                {ratingEntries.map(([rating]) => (
                  <div
                    key={rating}
                    className="relative shrink-0 text-controls-disable [&_path]:fill-current"
                  >
                    <IconStarFilled
                      size={18}
                      className={classNames(
                        averageRating > Number(rating) &&
                          'text-accent-secondary [&_path]:fill-current',
                      )}
                    />
                    {Math.ceil(averageRating) === Number(rating) && (
                      <IconStarFilled
                        size={18}
                        className="absolute top-0 text-accent-secondary"
                        style={{
                          clipPath: `polygon(0% 0%,${(1 - (Number(rating) % averageRating)) * 100}% 0%,${(1 - (Number(rating) % averageRating)) * 100}% 100%,0% 100%)`,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <ul className="flex w-full flex-col gap-2">
              {ratingEntries
                .map(([rating, count]) => (
                  <div className="flex w-full items-center gap-4" key={rating}>
                    <span className="text-sm">{rating}</span>
                    <RatingProgressBar total={totalRating} count={count} />
                  </div>
                ))
                .reverse()}
            </ul>
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex items-center gap-3">
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt={t('User avatar')}
                  className="shrink-0 rounded"
                  width={18}
                  height={18}
                />
              ) : (
                <UserIcon width={18} height={18} />
              )}
              <span className="text-sm">John Dough</span>
            </div>
            <RatingHandler
              onRatingApply={() =>
                dispatch(UIActions.showSuccessToast(t('Rate sent')))
              }
              onClose={() => setIsRate(false)}
            />
          </div>
        )}
      </section> */}
      {/* <section className="px-3 py-4 md:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('Details')}</h3>
          <button className="flex items-center gap-3 text-accent-primary">
            <IconAlertCircle size={18} />
            <span>{t('Report problem')}</span>
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-6 md:mt-5 md:flex-row md:gap-12">
          <div className="flex flex-col gap-2">
            <p className="font-semibold">{t('Author')}</p>
            <div className="flex items-center gap-2">
              <Image
                src="https://i.pravatar.cc/300"
                alt={t('application context menu icon')}
                height={22}
                width={22}
                className="shrink-0 rounded-full bg-error"
              />
              <span>{application.author.name}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold">{t('Release date')}</p>
            <span>{entity.releaseDate}</span>
          </div>
        </div>
      </section> */}
      {/* {fullScreenSlide !== undefined && (
        <FullScreenImage
          images={application.previewImages}
          alt={t('application preview')}
          onClose={() => setFullScreenSlide(undefined)}
          defaultIdx={fullScreenSlide}
        />
      )} */}
    </div>
  );
};

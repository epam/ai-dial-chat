import {
  IconAlertCircle,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconMessageStar,
  IconStarFilled,
} from '@tabler/icons-react';
import { useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';
import Image from 'next/image';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import round from 'lodash-es/round';

interface Props {
  application: {
    previewImages: string[];
    capabilities: string[];
    rating: Record<number, number>;
    version: string;
    releaseDate: string;
    author: {
      name: string;
      avatarUrl: string;
    };
    description: string;
  };
}

export const ApplicationDetailsContent = ({ application }: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

  const sliderRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredStars, setHoveredStars] = useState(0);
  const [isRate, setIsRate] = useState(false);

  const previewImgsCount = application.previewImages.length;
  const totalRating = Object.values(application.rating).reduce(
    (totalRating, rating) => totalRating + rating,
    0,
  );
  const ratingEntries = Object.entries(application.rating);

  return (
    <div className="divide-y divide-tertiary overflow-auto">
      <section className="px-5 py-6 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="relative overflow-hidden">
            <div
              ref={sliderRef}
              className="flex w-full gap-3 transition duration-1000 ease-out"
              style={{
                transform: sliderRef.current?.scrollWidth
                  ? `translateX(-${
                      activeSlide === previewImgsCount - 1
                        ? sliderRef.current.scrollWidth -
                          sliderRef.current.clientWidth
                        : (sliderRef.current.scrollWidth / previewImgsCount) *
                          activeSlide
                    }px)`
                  : 'none',
              }}
            >
              {application.previewImages.map((image) => (
                <div key={image} className="h-[221px] w-[393px] shrink-0">
                  <Image
                    src={image}
                    alt={t('application preview')}
                    height={221}
                    width={393}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                setActiveSlide((slide) => (!slide ? 0 : slide - 1))
              }
              className={classNames(
                'absolute start-0 top-0 h-full w-[100px] cursor-pointer items-center justify-center bg-gradient-to-r from-blackout transition duration-500',
                activeSlide !== 0 ? 'opacity-100' : 'opacity-0',
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
                'absolute end-0 top-0 flex h-full w-[100px] cursor-pointer items-center justify-end bg-gradient-to-l from-blackout transition duration-500',
                activeSlide !== previewImgsCount - 1
                  ? 'opacity-100'
                  : 'opacity-0',
              )}
            >
              <IconChevronRight className="text-secondary" size={30} />
            </button>
          </div>
          <p>{application.description}</p>
        </div>
      </section>
      <section className="p-6">
        <h3 className="text-lg font-semibold">{t('Capabilities')}</h3>
        <ul className="mt-5 flex list-none flex-col gap-4">
          {application.capabilities.map((capability) => (
            <li key={capability} className="flex items-center gap-2">
              <IconCheck size={18} className="text-success" />
              <p>{capability}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="p-6">
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
              <h4 className="text-5xl font-semibold">
                {round(
                  ratingEntries.reduce(
                    (acc, [rating, count]) => acc + Number(rating) * count,
                    0,
                  ) / totalRating,
                  1,
                )}
              </h4>
              <div className="flex">
                {ratingEntries.map(([rating]) => (
                  <IconStarFilled
                    key={rating}
                    size={18}
                    className="text-accent-secondary"
                  />
                ))}
              </div>
            </div>
            <ul className="flex w-full flex-col gap-2">
              {ratingEntries
                .map(([rating, count]) => (
                  <div className="flex w-full items-center gap-4" key={rating}>
                    <span className="text-sm">{rating}</span>
                    <div className="relative h-1.5 w-full rounded bg-layer-4">
                      <div
                        className="relative h-1.5 w-full rounded bg-accent-secondary"
                        style={{ width: `${(count / totalRating) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))
                .reverse()}
            </ul>
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex items-center gap-3">
              <Image
                src=""
                alt={t('User avatar')}
                className="shrink-0 rounded"
                width={18}
                height={18}
              />
              <span className="text-sm">John Dough</span>
            </div>
            <div
              className="mt-3 flex gap-2"
              onMouseLeave={() => setHoveredStars(0)}
            >
              {Object.keys(application.rating).map((strRating) => {
                const rating = Number(strRating);

                return (
                  <div
                    className={classNames(
                      'relative shrink-0 [&_path]:fill-transparent [&_path]:stroke-1',
                    )}
                    key={rating}
                  >
                    <IconStarFilled
                      size={32}
                      className={classNames(
                        (hoveredStars >= rating || selectedRating >= rating) &&
                          'text-accent-secondary [&_path]:fill-current',
                      )}
                    />
                    <input
                      onClick={() => setSelectedRating(rating)}
                      onMouseEnter={() => setHoveredStars(rating)}
                      className="absolute top-0 size-full shrink-0 cursor-pointer appearance-none border-none"
                      type="radio"
                      name="rate"
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex w-full justify-end gap-2">
              <button
                onClick={() => setIsRate(false)}
                className="rounded border-[1px] border-primary  px-3 py-2 text-sm font-semibold"
              >
                {t('Cancel')}
              </button>
              <button
                disabled={!selectedRating}
                className="rounded bg-accent-primary px-3 py-2 text-sm font-semibold disabled:bg-controls-disable disabled:text-controls-disable"
              >
                {t('Send')}
              </button>
            </div>
          </div>
        )}
      </section>
      <section className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('Details')}</h3>
          <button className="flex items-center gap-3 text-accent-primary">
            <IconAlertCircle size={18} />
            <span>{t('Report problem')}</span>
          </button>
        </div>
        <div className="my-5 flex gap-12">
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
            <span>{application.releaseDate}</span>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold">{t('Version')}</p>
            <span>{application.version}</span>
          </div>
        </div>
      </section>
    </div>
  );
};

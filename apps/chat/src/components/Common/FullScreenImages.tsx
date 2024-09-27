import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import { useState } from 'react';

import Image from 'next/image';

import classNames from 'classnames';

import { useMobileSwipe } from '@/src/hooks/useMobileSwipe';

import { ModalState } from '@/src/types/modal';

import Modal from './Modal';

interface Props {
  images: string[];
  alt: string;
  onClose: () => void;
  defaultIdx?: number;
}

const FullScreenImages = ({ images, alt, onClose, defaultIdx }: Props) => {
  const [currentImage, setCurrentImage] = useState(defaultIdx ?? 0);

  const swipeHandlers = useMobileSwipe({
    onSwipedLeft: () => {
      if (currentImage + 1 < images.length) {
        setCurrentImage((idx) => idx + 1);
      }
    },
    onSwipedRight: () => {
      if (currentImage !== 0) {
        setCurrentImage((idx) => idx - 1);
      }
    },
  });

  return (
    <Modal
      state={ModalState.OPENED}
      portalId="theme-main"
      hideClose
      dataQa="full-screen-img"
      containerClassName="flex items-center justify-center size-full !bg-layer-0"
      overlayClassName="z-[60] bg-layer-0"
      onClose={onClose}
    >
      <div className="size-full px-4 py-2">
        <div className="flex w-full justify-end">
          <div className="flex w-1/2 items-center justify-between">
            <span className="font-semibold md:text-lg">
              {currentImage + 1} / {images.length}
            </span>
          </div>
          <button
            className="rounded text-secondary hover:text-accent-primary"
            onClick={onClose}
          >
            <IconX height={24} width={24} />
          </button>
        </div>

        <div className="relative mt-10 flex h-5/6 w-full items-center">
          <button
            onClick={() => setCurrentImage((idx) => idx - 1)}
            disabled={currentImage === 0}
            className={classNames(
              'mr-10 hidden rounded-full border-[2px] p-3 md:block',
              currentImage === 0
                ? 'cursor-not-allowed border-primary text-controls-disable'
                : 'border-hover hover:border-accent-primary hover:text-accent-primary',
            )}
          >
            <IconChevronLeft size={18} />
          </button>
          <div className="relative flex size-full">
            <Image
              src={images[currentImage]}
              alt={alt}
              fill
              sizes="(max-width: 768px) 100vw"
              className="object-cover"
              {...swipeHandlers}
            />
          </div>
          <button
            onClick={() => setCurrentImage((idx) => idx + 1)}
            disabled={currentImage >= images.length - 1}
            className={classNames(
              'ml-10 hidden rounded-full border-[2px] p-3 md:block',
              currentImage >= images.length - 1
                ? 'cursor-not-allowed border-primary text-controls-disable'
                : 'border-hover hover:border-accent-primary hover:text-accent-primary',
            )}
          >
            <IconChevronRight size={18} />
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default FullScreenImages;

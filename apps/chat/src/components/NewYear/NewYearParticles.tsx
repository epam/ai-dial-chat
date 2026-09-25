import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, useMemo, type FC } from 'react';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import styles from './NewYear.module.scss';
import { buildNewYearParticles } from './particles';
import { NewYearScene } from './types';

interface Props {
  scene: NewYearScene.Snow | NewYearScene.Confetti;
}

const NewYearParticles: FC<Props> = ({ scene }) => {
  const isMobile = useIsMobile();
  const particles = useMemo(
    () => buildNewYearParticles(scene, isMobile),
    [scene, isMobile],
  );
  return (
    <div className={styles.particleLayer} aria-hidden="true">
      {particles.map((style, index) => (
        <span
          key={index}
          style={style}
          className={mergeClasses(
            styles.particle,
            scene === NewYearScene.Snow ? styles.snowflake : styles.confetti,
          )}
        />
      ))}
    </div>
  );
};

export const NewYearSnow: FC = () => (
  <NewYearParticles scene={NewYearScene.Snow} />
);
export const NewYearConfetti: FC = () => (
  <NewYearParticles scene={NewYearScene.Confetti} />
);

export default memo(NewYearParticles);

import { useEffect, useRef, useState, type FC } from 'react';
import { HALLOWEEN_TRAIN_AUDIO_SRC } from '../../constants/halloween';
import { useReducedMotion } from '../../hooks/celebration/useReducedMotion';
import {
  animateHalloweenTrain,
  buildHalloweenTrainPlan,
  getTrainPumpkin,
  type HalloweenTrainPlan,
} from '../../utils/halloween-train';
import HalloweenPumpkin from './HalloweenPumpkin';
import styles from './HalloweenTrain.module.scss';
import HalloweenTrainArtwork from './HalloweenTrainArtwork';

/** The seasonal pumpkin boards the empty wagon without moving its real button. */
const HalloweenTrain: FC = () => {
  const reducedMotion = useReducedMotion();
  const carrierRef = useRef<HTMLDivElement>(null);
  const passengerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<SVGSVGElement | null>(null);
  const [plan, setPlan] = useState<HalloweenTrainPlan | null>(null);
  const [ended, setEnded] = useState(false);
  const [prepared, setPrepared] = useState(false);
  useEffect(() => {
    setPlan(null);
    setPrepared(true);
    if (
      reducedMotion ||
      !carrierRef.current ||
      typeof carrierRef.current.animate !== 'function'
    )
      return;
    sourceRef.current = getTrainPumpkin();
    setPlan(
      buildHalloweenTrainPlan(
        carrierRef.current.getBoundingClientRect(),
        document.documentElement.clientWidth,
        sourceRef.current?.getBoundingClientRect(),
      ),
    );
  }, [reducedMotion]);
  useEffect(() => {
    setEnded(false);
    if (reducedMotion || !plan || !carrierRef.current || !passengerRef.current)
      return;
    return animateHalloweenTrain(
      plan,
      {
        carrier: carrierRef.current,
        passenger: passengerRef.current,
        source: sourceRef.current,
      },
      () => setEnded(true),
      HALLOWEEN_TRAIN_AUDIO_SRC,
    );
  }, [plan, reducedMotion]);
  const passenger = plan?.passenger;
  return (
    <div
      className={styles.scene}
      data-halloween-scene="train"
      aria-hidden="true"
    >
      <div
        ref={carrierRef}
        className={styles.train}
        data-train-carrier="true"
        style={{
          visibility:
            !prepared || (ended && !reducedMotion) ? 'hidden' : undefined,
        }}
      >
        <div
          className={styles.artwork}
          style={{ transform: plan?.mirrored ? 'scaleX(-1)' : undefined }}
        >
          <HalloweenTrainArtwork />
        </div>
        <div
          ref={passengerRef}
          className={styles.passenger}
          data-train-passenger="true"
          style={
            passenger
              ? {
                  left: passenger.left,
                  top: passenger.top,
                  width: passenger.width,
                  height: passenger.height,
                }
              : undefined
          }
        >
          <HalloweenPumpkin />
        </div>
        <div
          className={styles.artwork}
          style={{ transform: plan?.mirrored ? 'scaleX(-1)' : undefined }}
        >
          <HalloweenTrainArtwork foreground />
        </div>
      </div>
    </div>
  );
};
export default HalloweenTrain;

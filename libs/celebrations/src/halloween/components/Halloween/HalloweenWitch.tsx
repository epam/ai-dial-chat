import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { WitchPart } from '../../utils/halloween-witch-plan';
import styles from './HalloweenWitches.module.scss';

interface Props {
  /** Whether this is the composed mentor. Defaults to false. */
  mentor?: boolean;
}

/** Articulated seasonal illustration; the broom contact point is SVG (170,120). */
const HalloweenWitch: FC<Props> = ({ mentor = false }) => (
  <svg
    viewBox="0 0 180 150"
    aria-hidden="true"
    focusable="false"
    className={mergeClasses(
      styles.witch,
      'block size-full overflow-visible',
      mentor && styles.mentor,
    )}
  >
    <g data-witch-part={WitchPart.Broom} className={styles.broom}>
      <path d="M9 122Q87 117 153 120" className={styles.wood} />
      <path
        d="M143 114Q159 118 177 108L172 118L179 124L169 126L175 137Q156 125 143 128Z"
        className={styles.straw}
      />
      <path
        d="M150 119L172 115M149 122L173 124M149 125L169 132"
        className={styles.strawLines}
      />
      <path d="M143 115L142 127M147 116L146 129" className={styles.binding} />
      <g data-witch-part={WitchPart.Frog} className={styles.broomFrog}>
        <path
          d="M151 126Q137 134 148 140L161 140M168 125Q178 133 168 140L178 140"
          className={styles.frogLeg}
        />
        <ellipse cx="157" cy="112" rx="6" ry="8" className={styles.frogEye} />
        <ellipse cx="170" cy="111" rx="6" ry="8" className={styles.frogEye} />
        <ellipse cx="159" cy="112" rx="2" ry="4" className={styles.pupil} />
        <ellipse cx="172" cy="111" rx="2" ry="4" className={styles.pupil} />
      </g>
    </g>
    <g data-witch-part={WitchPart.Rider}>
      <path
        d="M79 100L105 112L101 131L115 133L120 138L95 141L89 133L91 119L67 113Z"
        className={styles.boot}
      />
      <g data-witch-part={WitchPart.Cloak} className={styles.cloakJoint}>
        <path
          d="M88 66Q63 59 54 88Q37 103 12 98L26 108L13 115Q52 133 88 115L106 102L98 77Z"
          className={styles.cloak}
        />
        <path
          d="M69 81Q58 112 28 111M75 90Q66 110 53 118"
          className={styles.fold}
        />
        <path d="M85 68L95 69L89 98L79 90Z" className={styles.lapel} />
        <circle cx="87" cy="82" r="3" className={styles.buckle} />
      </g>
      <g data-witch-part={WitchPart.Head} className={styles.headJoint}>
        <path
          d="M84 41Q72 58 76 78L84 72L88 82L96 69L94 46Z"
          className={styles.hair}
        />
        <path
          d="M89 38Q109 37 111 49L122 57L112 61Q112 71 101 72L86 65L83 50Z"
          className={styles.skin}
        />
        <path d="M106 66Q111 66 113 63" className={styles.expression} />
        <g data-witch-part={WitchPart.Gaze}>
          <ellipse
            cx="107"
            cy="51"
            rx="3.5"
            ry={mentor ? 2.2 : 4}
            className={styles.eye}
          />
          <ellipse
            cx="109"
            cy="51"
            rx="1.7"
            ry="2.3"
            className={styles.pupil}
          />
        </g>
        <path
          d={mentor ? 'M102 45L112 43' : 'M102 44Q108 41 112 46'}
          className={styles.expression}
        />
        <g data-witch-part={WitchPart.Hat} className={styles.hatJoint}>
          <path
            d={
              mentor
                ? 'M73 40L87 5Q98 12 111 9L105 22L113 43Z'
                : 'M73 40L82 7Q100 21 115 12L106 28L114 45Z'
            }
            className={styles.cloak}
          />
          <path d="M75 32L109 35L113 43L73 40Z" className={styles.ribbon} />
          <path
            d="M61 43Q77 36 89 42Q109 48 128 42L130 48Q94 57 61 43Z"
            className={styles.hatBrim}
          />
          <path d="M92 35L100 36L99 42L91 41Z" className={styles.buckle} />
        </g>
      </g>
      <g data-witch-part={WitchPart.Arm} className={styles.armJoint}>
        <path
          d="M96 77Q108 78 115 89L133 91L135 100L110 101L94 91Z"
          className={styles.cloak}
        />
        <path
          d="M130 91L141 88L146 91L139 95L145 97L138 101L132 99Z"
          className={styles.skin}
        />
      </g>
    </g>
  </svg>
);

/** Transparent frog features sized around, rather than replacing, a button copy. */
export const HalloweenFrogFeatures: FC = () => (
  <svg
    viewBox="0 0 100 80"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
    className={mergeClasses(styles.frog, 'block size-full overflow-visible')}
  >
    <g data-witch-frog-legs className={styles.frogLegs}>
      <path
        d="M17 56Q-2 63 9 73L23 73M83 56Q102 63 91 73L77 73"
        className={styles.frogLeg}
      />
      <path
        d="M20 73L16 78M13 73L10 77M80 73L84 78M87 73L90 77"
        className={styles.frogLeg}
      />
    </g>
    <ellipse cx="30" cy="13" rx="8" ry="11" className={styles.frogEye} />
    <ellipse cx="70" cy="13" rx="8" ry="11" className={styles.frogEye} />
    <ellipse cx="32" cy="13" rx="3" ry="5" className={styles.pupil} />
    <ellipse cx="72" cy="13" rx="3" ry="5" className={styles.pupil} />
  </svg>
);

export default HalloweenWitch;

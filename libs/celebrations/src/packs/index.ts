/* Loaded only after a host has resolved a pack, so `LottieScene` and the
   static trigger stay out of the main chunk. */
export { LottieScene } from '../components/LottieScene/LottieScene';
export type { LottieSceneProps } from '../components/LottieScene/LottieScene';
export { StaticTriggerDecoration } from '../components/StaticTriggerDecoration/StaticTriggerDecoration';
export type { StaticTriggerDecorationProps } from '../components/StaticTriggerDecoration/StaticTriggerDecoration';
export {
  createCelebrationEventFromDescriptor,
  createCelebrationSceneFromDescriptor,
  replaceCelebrationScenes,
} from '../utils/celebration-descriptor-event';

import { SuggestedCard } from '@/src/constants/talkTo';

import { DialAIEntityModel } from './models';

type SuggestedCardType = typeof SuggestedCard;

export type CardType = DialAIEntityModel | SuggestedCardType;

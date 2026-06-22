import {
  DEFAULT_RESOURCE_MAX_SEGMENT_BYTES,
  RESOURCE_MAX_ID_BYTES,
} from '@/src/constants/default-ui-settings';

let resourceMaxSegmentBytes = DEFAULT_RESOURCE_MAX_SEGMENT_BYTES;

export const initResourceMaxSegmentBytes = (value: number) => {
  resourceMaxSegmentBytes = value;
};

export const getResourceMaxSegmentBytes = () => resourceMaxSegmentBytes;

export const getResourceMaxIdBytes = () => RESOURCE_MAX_ID_BYTES;

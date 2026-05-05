import { AudioMimeType } from '@/src/constants/audio';

export interface AudioMimeCandidate {
  mimeType: string;
  baseMime: AudioMimeType;
  ext: string;
}

export interface NegotiatedFormat {
  mimeType: string;
  ext: string;
}

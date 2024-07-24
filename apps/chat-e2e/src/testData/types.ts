export interface TreeEntity {
  name: string;
  index?: number;
}

export type ElementState = 'visible' | 'hidden';

export type ElementCaretState = 'expanded' | 'collapsed';

export type ElementLabel = 'more' | 'less';

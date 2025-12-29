import { Attributes, Tags } from '@/src/ui/domData';

export const ButtonSelectors = {
  buttonContainer: (ariaLabel: string) =>
    `${Tags.button}[${Attributes.ariaLabel}="${ariaLabel}"]`,
};

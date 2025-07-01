'use client';

import {
  ChatOverlayWrapper,
  commonOverlayProps,
} from '../../components/chatOverlayWrapper';

import { MessageButtons } from '@epam/ai-dial-shared';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" />
    <path d="M13 10.5v3a1.5 1.5 0 0 0 3 0v-3a1.5 1.5 0 0 0 -3 0z" />
    <path d="M8 12h2" />
    <path d="M10 9h-2v6" />
</svg>
                `;

const overlayOptions = {
  ...commonOverlayProps,
  messageButtons: [
    {
      messageIndex: 0,
      buttons: [
        {
          buttonKey: 'custom-button-1',
          events: ['click'] as (keyof WindowEventMap)[],
          tooltip: 'Some tooltip',
          iconSvg: svg,
        },
        {
          buttonKey: 'custom-button-2',
          events: ['dblclick'] as (keyof WindowEventMap)[],
          iconSvg: svg,
          title: 'dblclick',
          styles: {
            backgroundColor: 'red',
          },
          hoverStyles: {
            backgroundColor: 'green',
          },
          focusStyles: {
            backgroundColor: 'blue',
          },
          disabledStyles: {
            backgroundColor: 'orange',
          },
        },
        {
          buttonKey: 'custom-button-3',
          events: ['mousedown'] as (keyof WindowEventMap)[],
          iconSvg: svg,
          title: 'disabled',
          skipDefaultStyles: true,
          disabled: true,
          disabledStyles: {
            backgroundColor: 'orange',
          },
        },
      ],
    },
  ] as MessageButtons[],
};

export default function Index() {
  return <ChatOverlayWrapper overlayOptions={overlayOptions} />;
}

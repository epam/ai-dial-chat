import { ChatOverlay } from '../overlay';

export const chatOverlayFlow = () => {
  const container = document.createElement('div');

  container.style.height = '700px';
  container.style.width = '500px';

  document.body.appendChild(container);

  let currentOptions = {
    hostDomain: window.location.origin,
    domain: 'http://localhost:3000',
    theme: 'light',
    modelId: 'gpt-4',
    enabledFeatures:
      'conversations-section,prompts-section,top-settings,top-clear-conversation,top-chat-info,top-chat-model-settings,empty-chat-settings,header,footer,request-api-key,report-an-issue,likes',
    requestTimeout: 20000,
    loaderStyles: {
      background: 'green',
      fontSize: '24px',
    },
  };

  const overlay = new ChatOverlay(container, currentOptions);

  overlay.subscribe('@DIAL_OVERLAY/GPT_END_GENERATING', () =>
    // eslint-disable-next-line no-console
    console.log('END GENERATING'),
  );

  overlay.subscribe('@DIAL_OVERLAY/GPT_START_GENERATING', () =>
    // eslint-disable-next-line no-console
    console.log('START GENERATING'),
  );

  overlay.getMessages().then((messages) => {
    // eslint-disable-next-line no-console
    console.log(messages);
  });

  const sendButton = document.createElement('button');
  sendButton.innerHTML = "Send 'Hello brothers' to Chat";
  sendButton.onclick = () => overlay.sendMessage('Hello brothers');

  const configurationButton = document.createElement('button');
  configurationButton.innerHTML = 'Update configuration on the fly';
  configurationButton.onclick = () => {
    const newOptions = { ...currentOptions };

    newOptions.theme = 'light';
    newOptions.modelId = 'statgpt';

    currentOptions = newOptions;
    overlay.setOverlayOptions(currentOptions);
  };

  const setRandomSystemPromptButton = document.createElement('button');
  setRandomSystemPromptButton.innerHTML = 'End each word with string "!?!?!"';
  setRandomSystemPromptButton.onclick = () => {
    overlay.setSystemPrompt('End each word with string "!?!?!"');
  };

  document.body.appendChild(sendButton);
  document.body.appendChild(configurationButton);
  document.body.appendChild(setRandomSystemPromptButton);
};

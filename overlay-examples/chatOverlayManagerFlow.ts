import { ChatOverlayManager } from '../libs/ai-dial-overlay/src';

export const chatOverlayManagerFlow = () => {
  const manager = new ChatOverlayManager();

  let currentOptions = {
    id: 'test',
    hostDomain: window.location.origin,
    domain: 'http://localhost:3000',
    theme: 'dark',
    enabledFeatures:
      'conversations-section,prompts-section,top-settings,top-clear-conversation,top-chat-info,top-chat-model-settings,empty-chat-settings,header,footer,request-api-key,report-an-issue,likes',
    modelId: 'statgpt-py',
    allowFullscreen: true,
    requestTimeout: 20000,
  };

  manager.createOverlay(currentOptions);

  manager.subscribe('test', '@DIAL_OVERLAY/GPT_END_GENERATING', () =>
    // eslint-disable-next-line no-console
    console.log('END GENERATING'),
  );

  manager.subscribe('test', '@DIAL_OVERLAY/GPT_START_GENERATING', () =>
    // eslint-disable-next-line no-console
    console.log('START GENERATING'),
  );

  manager.getMessages('test').then((messages) => {
    // eslint-disable-next-line no-console
    console.log(messages);
  });

  const sendButton = document.createElement('button');
  sendButton.innerHTML = "Send 'Hello brothers' to Chat";
  sendButton.onclick = () => manager.sendMessage('test', 'Hello brothers');

  const configurationButton = document.createElement('button');
  configurationButton.innerHTML = 'Update configuration on the fly';
  configurationButton.onclick = () => {
    const newOptions = { ...currentOptions };

    newOptions.theme = 'light';
    newOptions.modelId = 'statgpt';

    currentOptions = newOptions;
    manager.setOverlayOptions('test', currentOptions);
  };

  const setRandomSystemPromptButton = document.createElement('button');
  setRandomSystemPromptButton.innerHTML = 'End each word with string "!?!?!"';
  setRandomSystemPromptButton.onclick = () => {
    manager.setSystemPrompt('test', 'End each word with string "!?!?!"');
  };

  document.body.appendChild(sendButton);
  document.body.appendChild(configurationButton);
  document.body.appendChild(setRandomSystemPromptButton);
};

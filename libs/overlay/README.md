# DIAL Overlay

DIAL Overlay is a library designed for using AI DIAL Chat in an overlay format. It allows you to set up and interact with the chat via an iframe event-based protocol.

## Public Classes to Use

- `ChatOverlay` - a class which creates an iframe with DIAL and enables the interaction with it (send/receive messages). Types for configuration options is `ChatOverlayOptions`. Use it if you need nothing more than **1 iframe** and API to for interaction.
- `ChatOverlayManager` - a class which provides an overlay factory, different styles and animation for overlay (for example: opening animation, auto placement, fullscreen button, etc.). Types for configuration options is `ChatOverlayManagerOptions`. Use it if what you need is **several iframes** with API and you want it placed with predefined styles options.

## Prerequisites

[AI DIAL Chat application configuration](https://github.com/epam/ai-dial-chat/blob/development/apps/chat/README.md):

- `IS_IFRAME`: set this flag to `true` to enable Overlay.
- `ALLOWED_IFRAME_ORIGINS`: list all hosts where you are using the Overlay library. Note: For development purposes you can set `*`.

```
IS_IFRAME=true
ALLOWED_IFRAME_ORIGINS=http://localhost:8000
```

## Integration with AI DIAL Chat

Follow these steps to integrate the Overlay library with the AI DIAL Chat application:

1. Install the Overlay library

```bash
npm i @epam/ai-dial-overlay
```

2. Add a file to the serving folder in your application or just import it in code

```typescript
import { ChatOverlay, ChatOverlayManager, ChatOverlayOptions } from '@epam/ai-dial-overlay';
```

3. Create an instance of `ChatOverlay` (to use just one overlay and nothing more) or `ChatOverlayManager` (if you want to create more than one ChatOverlay, or additional style options, like positions, animations, etc.)

`ChatOverlay`:

```typescript
const container = document.create('div');
document.body.appendChild(container);

const run = async () => {
  const overlay: ChatOverlayOptions = new ChatOverlay(container, {
    // required, url of host application, needed for security reasons
    hostDomain: window.location.origin,
    // required, url of hosted DIAL application
    domain: 'https://your-hosted-overlay-domain.com',
    // optional, theme, 'light' | 'dark'
    theme: 'light',
    // optional, name of model that could be by default
    modelId: 'gpt-4',
    // optional, if DIAL doesn't respond in requestTimeout ms, overlay will throw an exception
    requestTimeout: 20000,
    // optional, features that should be enabled
    enabledFeatures: ['conversations-section', 'prompts-section', 'top-settings', 'top-clear-conversation', 'top-chat-info', 'top-chat-model-settings', 'empty-chat-settings', 'header', 'footer', 'request-api-key', 'report-an-issue', 'likes'],
    // optional, styles for loading which are showing until overlay installing settings
    loaderStyles: {
      background: 'black',
    },
    // optional, class for loader
    loaderClass: 'overlay__loader',
    // optional, id of the conversation to be selected at the start
    overlayConversationId: 'some-conversation-id',
    // optional, if DIAL should redirect to sign in the same browser window
    signInInSameWindow: false,
  });

  // overlay loaded application and ready to send and receive information from the application
  await overlay.ready();

  // return messages from the first selected conversation
  const { messages } = await overlay.getMessages();

  // send message to the first selected conversation
  await overlay.sendMessage('Hello chat!');

  // set system prompt. For chat gpt is first message like { role: 'system', message: "be patient and supportive!"}.
  await overlay.setSystemPrompt('Be patient and supportive!');

  // set overlay options on the fly
  await overlay.setOverlayOptions({
    hostDomain: window.location.origin,
    domain: 'https://your-hosted-overlay-domain.com',
    theme: 'dark',
    modelId: 'statgpt',
    requestTimeout: 11111,
  });

  // subscribing to GPT_START_GENERATING event
  const unsubscribe = overlay.subscribe('@DIAL_OVERLAY/GPT_START_GENERATING', () => console.log('Starting...'));

  // to unsubscribe use a callback returned by the subscribe method
  unsubscribe();
};
```

`ChatOverlayManager`:

The same principle applies to `ChatOverlayManager` as for `ChatOverlay` but with minor changes. Specify overlay displaying options and id for a new instance.

```typescript
ChatOverlayManager.createOverlay({
    id: 'test',
    position: 'left-bottom',
    width: 300,
    height: 300,
    zIndex: 6,
    ...ChatOverlayOptions
});

ChatOverlayManager.removeOverlay('test');
ChatOverlayManager.hideOverlay('test');
ChatOverlayManager.showOverlay('test');
...
ChatOverlayManager.getMessages('test');
ChatOverlayManager.sendMessage('test', 'Hi chat!');
...
```

## Internal Structure

Information in this section can be useful for overlay developers or anyone interested in its technical implementation.

Overlay communication, as all iframe communication, is implemented using [javascript post message](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).

There are 2 parts of implementation:

1. `ChatOverlay` library
2. DIAL `postMessage` listeners

### ChatOverlay

Main methods and practices that allow us to communicate with AI DIAL:

1. `ChatOverlay` is the class which in constructor creates an iframe and sets the origin of the deployed version of DIAL. That is how it works for the end user:

```typescript
const overlay = new ChatOverlay({domain: "https://overlay-domain.com", ...});

overlay.getSomething().then(...);
```

2. `Overlay` uses `Task` - a class which contains `Promise` with external function `resolve`. It is needed for cases when you want to resolve `promise` not only in this way `Promise((resolve) => resolve(...))`, but also like this: `currentPromise.complete()`

Main logic that is used there:

```typescript
let complete;

const promise = new Promise((resolve) => {
  complete = resolve;
});

complete(); // we can resolve promise outside the constructor callback
```

3. `Overlay` uses `DeferredRequest`. Its principle is similar to the one of `Task`, but contains an additional business logic. For example: a timeout for completing a task, generating uuid of request, payload of request, matching request algorithm, etc.
4. `Overlay` includes a `Task` which is called `this.iframeInteraction`. When `this.iframeInteraction` is completed, it means that we can receive and send messages. There is a method `ready()`, it displays `this.iframeInteraction.ready()`.
5. For communication, `ChatOverlay` uses a method `send()`. Things to know about this method:
   1. It generates a new `DeferredRequest`, inputs the required information into `this.requests`, and sends a post message.
   2. It entirely relies on `this.ready()`. No requests will be processed until `this.ready()`.

```typescript
...send method...
await send() {
    await this.ready();

    ...
    // it shouldn't be executed until this.ready()
    this.requests.push(new DeferredRequest(...));
}
```

6. In `window.addEventListener('message', this.process)`, `this.process` checks that the message contains a payload that can be matched with any request in `this.requests` or just an event. Prior to all this, it is necessary to check that application has sent us `@DIAL_OVERLAY/READY` and we can complete `this.iframeInteraction`.

```typescript
...handle post message...

if (event.data.type === "@DIAL_OVERLAY/READY") {
    this.iframeInteraction.complete();
    return;
}
```

7. In constructor, we send a configuration to the application (it's handshake, we will get a ready event, after we will say our domain and additional information), `this.send()` depends from `this.iframeInteraction`. **Note**: nothing is sent, until we get the `'@DIAL_OVERLAY/READY'`!

```typescript
    constructor() {
        ...
        this.setOverlayOptions({...});
    }
```

8. Method `subscribe` just adds a callback to `this.subscriptions`. In `this.process`, we call `this.processEvent` if we don't have `requestId`. Returns the callback which removes `callback` from `this.subscriptions`

```typescript
subscribe(eventType: string, callback: () => void) {
    this.subscriptions.push({ callback, eventType });
}
```

9. We are showing the loader until AI DIAL Chat notifies that `OverlayOptions` is installed.

### DIAL Chat

This part includes main methods and practices for communication with the host. Business logic related to overlay is located in `overlay.epics.ts, overlay.reducers.ts` and has own slice.

1. `postMessageMapperEpic`: the main `epic` that parses post messages and dispatches the necessary actions to other internal epics to separate business logic.
2. `notifyHostAboutReadyEpic`: sends `'@DIAL_OVERLAY/READY'` to the host.
3. `setOverlayConfigEpic`: listens when the host sends a configuration (incl. `hostDomain`, to not broadcast information to other participants of the host page).

Other epics are self-explanatory.

**To add a new method**:

1. Add action to the overlay slice.
2. Add dispatch action to `postMessageMapper`.
3. Add `epic` which gets all needed information from the common store and sends the result using `sendPMResponse`.

**To add a new event**:

1. Add `epic` which gets the necessary information.
2. Send the result to the host using `sendPMEvent`.

### Overlay sandbox

To experiment with overlay, refer to [overlay sandbox samples](https://github.com/epam/ai-dial-chat/tree/development/apps/overlay-sandbox/README.md)

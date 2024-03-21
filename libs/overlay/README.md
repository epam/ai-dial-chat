# DIAL Overlay

Dial Overlay is a library for using AI DIAL Chat in overlay. You can configure and communicate with chat using iframe event based protocol.

## Public classes to use

`ChatOverlay` - class which creates iframe with DIAL, allows to interact with it (send/receive messages). Types for configuration options is `ChatOverlayOptions`.

`ChatOverlayManager` - class which provides overlay factory, different styles and animation for overlay (for example: opening animation, auto placement, fullscreen button, etc.). Types for configuration options is `ChatOverlayManagerOptions`.

If you need **only 1 iframe** and API to interact and nothing more - **use `ChatOverlay`**

If you need **several iframes** with API and you want that it should be placed with pre-prepared styles options - **use `ChatOverlayManager`**

## Prerequisites

Your Dial Chat application should configure host where you are using this library with `ALLOWED_IFRAME_ORIGINS` env variable

\_Note: For development purposes you can set `*`\_

```
ALLOWED_IFRAME_ORIGINS=http://localhost:8000
```

## For integration with _DIAL CHAT_ you should do these steps:

1. Install library

```bash
npm i @epam/ai-dial-overlay
```

2. Add file to serving folder in your application or just import it in code

```typescript
import { ChatOverlay, ChatOverlayManager, ChatOverlayOptions } from '@epam/ai-dial-overlay';
```

3. Create an instance of `ChatOverlay` (to just overlay and nothing more) or `ChatOverlayManager` (if you want create more than 1 ChatOverlay, or additional style options, like positions, animations, etc.)

`ChatOverlay:`

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
    // optional, if DIAL doesn't respond in requestTimeout ms, overlay will throw exception
    requestTimeout: 20000,
    // optional, features that should be enabled
    enabledFeatures: ['conversations-section', 'prompts-section', 'top-settings', 'top-clear-conversation', 'top-chat-info', 'top-chat-model-settings', 'empty-chat-settings', 'header', 'footer', 'request-api-key', 'report-an-issue', 'likes'],
    // optional, styles for loading which are showing until overlay installing settings
    loaderStyles: {
      background: 'black',
    },
    // optional, class for loader
    loaderClass: 'overlay__loader',
  });

  // overlay loaded application and ready to send and receive information from the application.
  await overlay.ready();

  // return messages from the first selected conversation.
  const { messages } = await overlay.getMessages();

  // send message to the first selected conversation.
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

  // to unsubscribe use callback that method subscribe is returned
  unsubscribe();
};
```

`ChatOverlayManager:`

For manager the same as for `ChatOverlay` but with some minor changes. You should specify overlay displaying options and id for new instance.

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

## Internal structure

That part would be useful for overlay developers or people who might be interested in tech implementation.

Overlay communication, as all iframe communication, implemented using [javascript post message](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).

There is 2 parts of implementation:

1. ChatOverlay library
2. DIAL post message listeners

### ChatOverlay

Main methods and practices that allow us to communicate with DIAL:

1. `ChatOverlay` is the class which in constructor is creating iframe and set origin of deployed version of DIAL.
   That how it should work for end user

```typescript
const overlay = new ChatOverlay({domain: "https://overlay-domain.com", ...});

overlay.getSomething().then(...);
```

2. `Overlay` uses `Task`, it's a class which contain `Promise` with external function resolve. It's needed for cases when you want resolve promise not only in this way `Promise((resolve) => resolve(...))`, you want to do something like this: `currentPromise.complete()`

Main logic that used there:

```typescript
let complete;

const promise = new Promise((resolve) => {
  complete = resolve;
});

complete(); // we can resolve promise outside the constructor callback
```

3. `Overlay` uses `DeferredRequest`, it's the same as `Task` by conception, but contains more business specific logic. For example: timeout for completing task, generating uuid of request, payload of request, matching request algorithm, etc.
4. Chat overlay contains `Task` which called `this.iframeInteraction`. When `this.iframeInteraction` is complete, that's mean we can receive and send messages. There is method `ready()`, it's displaying `this.iframeInteraction.ready()`
5. For communication ChatOverlay uses the method `send()`. There are parts that you should know about this method:
   1. It's creating the new `DeferredRequest`, setting necessary info and putting to `this.requests`, and sending post message.
   2. That's totally depends `this.ready()`. No requests would be processed until `this.ready()`

```typescript
...send method...
await send() {
    await this.ready();

    ...
    // it shouldn't executed until this.ready()
    this.requests.push(new DeferredRequest(...));
}
```

6. `window.addEventListener('message', this.process)`, `this.process` is checking that some message contains payload that we can match with some request in `this.requests` or just event. Before them all is checking that application send us `@DIAL_OVERLAY/READY` and we can complete `this.iframeInteraction`.

```typescript
...handle post message...

if (event.data.type === "@DIAL_OVERLAY/READY") {
    this.iframeInteraction.complete();
    return;
}
```

7. In constructor we're sending configuration to application (it's handshake, we will get ready event, after we will say our domain and additional information), `this.send()` depends from `this.iframeInteraction`. Until we don't get the `'@DIAL_OVERLAY/READY'` we don't send something, don't worry.

```typescript
    constructor() {
        ...
        this.setOverlayOptions({...});
    }
```

8. Method `subscribe` just add callback to `this.subscriptions`. In `this.process` we call `this.processEvent` if we don't have `requestId`. Returns the callback which removes `callback` from `this.subscriptions`

```typescript
subscribe(eventType: string, callback: () => void) {
    this.subscriptions.push({ callback, eventType });
}
```

9. We're showing loader until DIAL Chat notify that OverlayOptions is installed.

### DIAL Chat side

Main methods and practices that allow us to communicate with host.

Business logic which related to overlays are located in `overlay.epics.ts, overlay.reducers.ts` and has own slice.

1. `postMessageMapperEpic`, main epic that parse post message and dispatch necessary action to other internal epics to separate business logic.
2. `notifyHostAboutReadyEpic`, send to host `'@DIAL_OVERLAY/READY'`
3. `setOverlayConfigEpic`, listens when host send configuration (incl. hostDomain, to not broadcast information to other participants of host page).

Other epics self described.

**Flow to add some new method**:

1. Add action to overlay slice
2. Add dispatch action to postMessageMapper
3. Add epic which get all needed information from common store and send result using `sendPMResponse`.

**Flow to add some new event**:

1. Add epic which get necessary information
2. Send result to host using `sendPMEvent`

# DIAL Chat Visualizer Connector

DIAL Chat Visualizer Connector is a library for connecting custom visualizers - applications which could visualize some special type data (for example **plot data** for the **Plotly**).

## Public classes to use

`ChatVisualizerConnector` - class which provides needed methods for the **Visualizer**(rendered in the iframe) to interact with **DIAL Chat** (receive data to visualize). Types for configuration options are `ChatVisualizerConnector` and `AttachmentData`.

## Prerequisites

For security reason your Dial Chat application should configure sources where your custom visualizers hosted:

- `ALLOWED_IFRAME_SOURCES` - list of allowed iframe sources in `<source> <source>` format.

_Note: For development purposes you can set `*`_

```
ALLOWED_IFRAME_SOURCES=http://localhost:8000
```

Moreover, it needs to be configured some **Visualizer** properties:

- `CUSTOM_VISUALIZERS` - list of the objects with custom visualizers properties. This properties are : `{ title, description, icon, contentType, url }`.

```typescript
interface CustomVisualizer {
  title: string;
  description: string;
  icon: string;
  contentType: string;
  url: string;
}
```

```json
CUSTOM_VISUALIZERS=[
                    {
                      "title":"CUSTOM_VISUALIZER", // Visualizer title
                      "description": "CUSTOM VISUALIZER to render images", // Short description for the Visualizer
                      "icon":"data:image/svg+xml;base64,some-base64-image", // Icon for the Visualizer
                      "contentType":"image/png,image/jpg", // List of MIME types that Visualizer could render separated by ","
                      "url":"http://localhost:8000" // Visualizer host
                    },
                    {
                      //Other Visualizer
                    }

                  ]

```

## To integrate **Visualizer** with _DIAL CHAT_.

1. Install library

```bash
npm i @epam/ai-dial-chat-visualizer-connector
```

2. Add file to serving folder in your application or just import it in code

```typescript
import { AttachmentData, ChatVisualizerConnector } from '@epam/ai-dial-chat-visualizer-connector';
```

3. Set `dialHost` to the _DIAL CHAT_ host you want to connect:

```typescript
const dialHost = 'https://hosted-dial-chat-domain.com';
```

4. Set `appName` same as `title` in the _DIAL CHAT_ configuration in the `CUSTOM_VISUALIZERS`:

```typescript
const appName = 'CUSTOM_VISUALIZER';
```

5. Create an instance of `ChatVisualizerConnector` in your code.

`ChatVisualizerConnector:`

```typescript
//Here you store your data which you get from the DIAL CHAT
const [data, setData] = useState<AttachmentData>();

const chatVisualizerConnector = useRef<ChatVisualizerConnector | null>(null);

useEffect(() => {
  if (!chatVisualizerConnector.current && dialHost && appName) {
    chatVisualizerConnector.current = new ChatVisualizerConnector(dialHost, appName, setData);

    return () => {
      chatVisualizerConnector.current?.destroy();
      chatVisualizerConnector.current = null;
    };
  }
}, [appName, dialHost]);
```

6. Send 'READY' event via `sendReady()` to the _DIAL CHAT_ to inform that your **Visualizer** is ready (this action will hide loader). Then you could do some preparation (login, etc.) and, after that, send 'READY TO INTERACT' event via `sendReadyToInteract()` to inform _DIAL CHAT_ that **Visualizer** is ready to receive data.

```typescript
useEffect(() => {
  if (appName && dialHost) {
    chatVisualizerConnector.current?.sendReady();
    //Make some actions if needed
    chatVisualizerConnector.current?.sendReadyToInteract();
  }
}, [dialHost, appName]);
```

7. Make needed type assertion for the data from the _DIAL CHAT_

_Note: Data send by model/application from DIAL CHAT should be the same type as you expect._

```typescript
data.visualizerData as { dataToRender: string; layout: Layout };
```

8. Render data in your **Visualizer**;

```tsx
<div>{typedVisualizerData.dataToRender}</div>
```

### Full React code example to connect your custom visualizer:

`Module.tsx`

```typescript

import { AttachmentData, ChatVisualizerConnector } from '@epam/ai-dial-chat-visualizer-connector';

export const Module: FC = () => {
  const [data, setData] = useState<AttachmentData>();

  const chatVisualizerConnector = useRef<ChatVisualizerConnector | null>(
    null
  );

  //DIAL CHAT host
  const dialHost = 'https://hosted-dial-chat-domain.com';

  //Visualizer title. Should be same as in the DIAL CHAT configuration in CUSTOM_VISUALIZERS
  const appName = 'CUSTOM_VISUALIZER';

  useEffect(() => {
    if (!chatVisualizerConnector.current && dialHost && appName) {
      chatVisualizerConnector.current = new ChatVisualizerConnector(
        dialHost,
        appName,
        setData
      );

      return () => {
        chatVisualizerConnector.current?.destroy();
        chatVisualizerConnector.current = null;
      };
    }
  }, [appName, dialHost]);

  useEffect(() => {
    if (appName && dialHost) {
      chatVisualizerConnector.current?.sendReady();
      chatVisualizerConnector.current?.sendReadyToInteract();
    }
  }, [dialHost, appName]);

  const typedVisualizerData = React.useMemo(() => {
    return (
      data?.visualizerData && (data.visualizerData as { dataToRender: string })
    );
  }, [data?.visualizerData]);

  return (
    <div>
      {!!typedVisualizerData?.dataToRender && (
          <div>
            {typedVisualizerData.dataToRender}
          </div>
      )}
    </div>
  );
};

```

`index.ts`

```typescript
//...other imports
import { Module } from "./Module.tsx";

const root = createRoot(document.getElementById("root"));
root.render(<Module />);

```

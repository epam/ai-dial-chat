# DIAL Visualizer Connector

DIAL Visualizer Connector is a library for connecting custom visualizers - applications which could visualize some special type data (for example **plot data** for the **Plotly**).

## Public classes to use

`VisualizerConnector` - class which creates iframe with provided **VisualizerConnector**, allows to interact with **Visualizer** rendered in the iframe (send/receive messages). Types for configuration options is `VisualizerConnector`.

## Prerequisites

Your Dial Chat application should configure hosts where your custom visualizers hosted. You could do this with `ALLOWED_VISUALIZERS_IFRAME_ORIGINS` env variable

\_Note: For development purposes you can set `*`\_

```
ALLOWED_VISUALIZERS_IFRAME_ORIGINS=http://localhost:8000
```

Moreover, it needs to be configured some **Visualizer** properties:

- `CUSTOM_VISUALIZERS_TYPES` - list of the attachment content types for which you want to use custom visualizers.

```
CUSTOM_VISUALIZERS_TYPES='<custom_type_1>, <custom_type_2>'
```

- `CUSTOM_VISUALIZERS` - list of the objects with custom visualizers properties. This properties are : `{ Title, Description, Icon, ContentType, Url }`.

```
CUSTOM_VISUALIZERS=[{"Title":"CUSTOM_VISUALIZER","Description": "CUSTOM VISUALIZER to render images","Icon":"https://some-path.svg","ContentType":"image/png","Url":"http://localhost:8000"}]

```

## To integrate **Visualizer** with _DIAL CHAT_.

React code example to connect your custom visualizer:

`Module.tsx`

```typescript

enum VisualizerConnectorEvents {
  initReady = "INIT_READY",
  ready = "READY",
  readyToInteract = "READY_TO_INTERACT",
}

enum VisualizerConnectorRequests {
  sendVisualizeData = "SEND_VISUALIZE_DATA",
  setVisualizerOptions = "SET_VISUALIZER_OPTIONS",
}

interface VisualizerData {
  message: string;
}

interface AttachmentData {
  mimeType: string;
  visualizerData: VisualizerData;
}

interface VisualizerOptions {
  theme: string;
}

interface RendererData {
  type: VisualizerConnectorRequests;
  requestId: string;
  payload: AttachmentData | VisualizerOptions;
}

interface PostMessageRequestParams {
  requestId: string;
  dialHost: string;
  payload?: unknown;
}

export const Module: React.FC = () => {
  const [data, setData] = useState<VisualizerData>();
  const [options, setOptions] = useState<VisualizerOptions>();

  const dialHost = process.env.REACT_APP_DIAL_HOST;
  const appName = process.env.REACT_APP_APP_NAME;

  useEffect(() => {
    //Function to send postMessage response
    const sendPMResponse = (
      type: VisualizerConnectorRequests,
      requestParams: PostMessageRequestParams
    ) => {
      const { requestId, dialHost, payload } = requestParams;

      window?.parent.postMessage(
        {
          type: `${type}/RESPONSE`,
          requestId,
          payload,
        },
        dialHost
      );
    };
    const postMessageListener = (event: MessageEvent<RendererData>) => {
      if (event.origin !== dialHost) return;
      //check if there is a payload
      if (typeof event.data.payload !== "object") return;

      if (
        event.data.type ===
        `${appName}/${VisualizerConnectorRequests.setVisualizerOptions}`
      ) {
        event.data.payload.hasOwnProperty("theme") &&
          setOptions(event.data.payload as VisualizerOptions);

        //It needs to send type: `${type}/RESPONSE` to notify the DIAL_CHAT data received
        sendPMResponse(event.data.type, {
          dialHost: event.origin,
          requestId: event.data.requestId,
        });
      }
      if (
        event.data.type ===
        `${appName}/${VisualizerConnectorRequests.sendVisualizeData}`
      ) {
        const payload =
          event.data.payload.hasOwnProperty("visualizerData") &&
          (event.data.payload as AttachmentData);

        payload && setData(payload.visualizerData);

        //It needs to send type: `${type}/RESPONSE` to notify the DIAL_CHAT data received
        sendPMResponse(event.data.type, {
          dialHost: event.origin,
          requestId: event.data.requestId,
        });
      }
    };
    window.addEventListener("message", postMessageListener, false);

    return () => window.removeEventListener("message", postMessageListener);
  }, [dialHost, appName]);

  useEffect(() => {
    if (appName && dialHost) {
      //We need to send 'ready' event to notify that visualizer ready to get options
      window?.parent.postMessage(
        { type: `${appName}/${VisualizerConnectorEvents.ready}` },
        dialHost
      );
      //We need to send 'readyToInteract' event to notify that visualizer ready to render data
      //You could send this event after some preparation for example log in
      window?.parent.postMessage(
        { type: `${appName}/${VisualizerConnectorEvents.readyToInteract}` },
        dialHost
      );
    }
  }, [dialHost, appName]);

  return (
    <div style={{ margin: "50px", color: "whitesmoke" }}>
      <h1 style={{ fontSize: "18px", fontWeight: "600" }}>
        Hello from Custom VIsualizer !!!
      </h1>
      {/*Render data with your Visualizer*/}
      {data?.message && (
        <div style={{ margin: "20px", background: "#06864b" }}>
          {data.message}
        </div>
      )}

      {!data?.message && (
        <div
          style={{
            background: "#eb150e",
          }}
        >
          No Data!!!
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

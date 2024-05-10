# DIAL Visualizer Connector

DIAL Visualizer Connector is a library for connecting DIAL CHAT with custom visualizers - applications which could visualize some special type data (for example **plot data** for the **Plotly**).

## Public classes to use

`VisualizerConnector` - class which creates iframe with provided **VisualizerConnector**, allows to interact with **ChatVisualizerConnector** rendered in the iframe (send/receive messages). Types for configuration options is `VisualizerConnectorOptions`.

## Prerequisites

Your Dial Chat application should configure hosts where your custom visualizers hosted. You could do this with `ALLOWED_IFRAME_SOURCES` env variable

\_Note: For development purposes you can set `*`\_

```
ALLOWED_IFRAME_SOURCES=http://localhost:8000
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

At **Visualizer** side should be used [DIAL Chat VIsualizer Connector](https://github.com/epam/ai-dial-chat/blob/development/libs/chat-visualizer-connector/README.md)

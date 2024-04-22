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

- `CUSTOM_CONTENT_TYPES` - list of the content types for which you want to use custom visualizers.

```
CUSTOM_CONTENT_TYPES='image/png,image/jpg'
```

- `CUSTOM_VISUALIZERS` - list of the objects with custom visualizers properties. This properties are : `{ Title, Description, Icon, ContentType, Url }`.

```
CUSTOM_VISUALIZERS=[{"Title":"CUSTOM_VISUALIZER","Description": "CUSTOM VISUALIZER to render images","Icon":"data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiAgd2lkdGg9IjI0IiAgaGVpZ2h0PSIyNCIgIHZpZXdCb3g9IjAgMCAyNCAyNCIgIGZpbGw9Im5vbmUiICBzdHJva2U9ImN1cnJlbnRDb2xvciIgIHN0cm9rZS13aWR0aD0iMiIgIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgIHN0cm9rZS1saW5lam9pbj0icm91bmQiICBjbGFzcz0iaWNvbiBpY29uLXRhYmxlciBpY29ucy10YWJsZXItb3V0bGluZSBpY29uLXRhYmxlci1oZWFydC1yYXRlLW1vbml0b3IiPjxwYXRoIHN0cm9rZT0ibm9uZSIgZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0zIDRtMCAxYTEgMSAwIDAgMSAxIC0xaDE2YTEgMSAwIDAgMSAxIDF2MTBhMSAxIDAgMCAxIC0xIDFoLTE2YTEgMSAwIDAgMSAtMSAtMXoiIC8+PHBhdGggZD0iTTcgMjBoMTAiIC8+PHBhdGggZD0iTTkgMTZ2NCIgLz48cGF0aCBkPSJNMTUgMTZ2NCIgLz48cGF0aCBkPSJNNyAxMGgybDIgM2wyIC02bDEgM2gzIiAvPjwvc3ZnPg==","ContentType":"image/png","Url":"http://localhost:8000"}]

```

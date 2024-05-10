# DIAL Visualizer Connector

DIAL Visualizer Connector is a library for connecting DIAL CHAT with custom visualizers - applications which could visualize some special type data (for example **plot data** for the **Plotly**).

## Public classes to use

`VisualizerConnector` - class which creates iframe with provided **VisualizerConnector**, allows to interact with **ChatVisualizerConnector** rendered in the iframe (send/receive messages). Types for configuration options is `VisualizerConnectorOptions`.

## Prerequisites

How to configure your DIAL CHAT to use **Custom Visualizers** you could find [here](./libs/chat-visualizer-connector/README.md).

At **Visualizer** side should be used [DIAL Chat VIsualizer Connector](./libs/chat-visualizer-connector/README.md)

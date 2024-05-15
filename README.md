# DIAL Chat

DIAL Chat is a default UI for [AI DIAL](https://epam-rail.com). AI DIAL can be used as headless system, but UI is recommended to learn the capability.

Originally forked from [chatbot-ui](https://github.com/mckaywrigley/chatbot-ui) and then completely reworked and published under [apache 2.0 license](./LICENSE), while code taken from original repository is still subject to [original MIT license](./license-original). Due to rework we introduced lots of new features such as varios IDP support, model side-by-side compare, [DIAL extensions](https://epam-rail.com/extension-framework) support, conversation replays, branding and many more.

![ai-dial-chat](./docs/ai-dial-chat.png)

## Overview

This repository is managed as monorepo by [NX](https://nx.dev/) tools.

## Docs

`DIAL Chat` documentation placed [here](./apps/chat/README.md).

`DIAL Chat Theming` documentation is placed [here](./docs/THEME-CUSTOMIZATION.md).

`DIAL Overlay` documentation is placed [here](./libs/overlay/README.md).

## Development

To work with this repo we are using NX.

_Note: All commands could be found in scripts section in [package.json](./package.json)._

### Install

```bash
npm i
```

### Build

It will build all projects which support this target (`chat`, `overlay-sandbox`).

```bash
npm run build
```

### Serve

To run project it's better to use `npm run nx serve` with project specified

```bash
npm run nx serve project-name
```

### Tests

To run tests for full repo

```bash
npm run test
```

### Publish

To run npm publish for all publishable libraries

```bash
npm run publish -- --ver=*.*.* --tag=* --dry --development
```

Params (all optional):

```
ver - version to publish
dry - dry run
tag - tag to publish with (default: 'next')
development - if set and not version provided will increment version automatically according to current global package.json version (e.g. 0.5.0-rc.1, 0.5.0-rc.2, etc.)
```

**It also supported to have run publish in 'dry' mode - nothing will be published, just displayed on screen**

```bash
npm run publish -- --dry
```

or just

```bash
npm run publish:dry
```

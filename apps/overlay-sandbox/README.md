# Overlay sandbox

Overlay sandbox contains examples of applications based on overlay library.

Before starting apps, need to specify the `NEXT_PUBLIC_OVERLAY_HOST` env variable that refers to the DIAL chat host launched in overlay mode and the `NEXT_PUBLIC_OVERLAY_USER_BUCKET` variable that corresponds to the user bucket suppose to use the sandbox.
See [DIAL Overlay](https://github.com/epam/ai-dial-chat/blob/development/libs/overlay/README.md) for details.

Run the following command to start sandbox: `nx run overlay-sandbox:"serve:sandbox"`

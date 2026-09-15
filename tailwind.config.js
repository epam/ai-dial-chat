/*
 * Workspace Tailwind config. The design-token theme lives in
 * libs/chat-shared/tailwind-preset.cjs, which is published to hosts as
 * `@epam/ai-dial-chat-shared/tailwind-preset` — this file adds only the globs
 * that are specific to this repository, so the theme has one owner.
 *
 * Every app and lib config extends this file
 * (`presets: [require('../../tailwind.config.js')]`), so they inherit the
 * preset transitively.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('./libs/chat-shared/tailwind-preset.cjs')],
  content: [
    './apps/chat/src/**/*.{html,js,ts,tsx,yaml}',
    './node_modules/@epam/ai-dial-ui-kit/**/*.{js,ts,jsx,tsx}',
    './node_modules/@epam/ai-dial-react-file-manager/**/*.{js,ts,jsx,tsx}',
  ],
};

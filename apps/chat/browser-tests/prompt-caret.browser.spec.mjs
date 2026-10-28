import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import express from 'express';
import { chromium } from 'playwright';
import { build } from 'vite';

const workspace = resolve(import.meta.dirname, '../../..');

/*
 * A prompt picked in the "Prompt parameters" popup is inserted at the caret.
 * When a link adds a skill mention first, the composer's textarea has never
 * been focused, so where the browser puts the caret decides whether the text
 * lands after the mention or in front of it. jsdom cannot tell: it has neither
 * `execCommand('insertText')` nor a real selection model.
 */
test(
  'text inserted into a never-focused composer lands after the seeded skill mention',
  { timeout: 180_000 },
  async () => {
    const fixture = resolve(workspace, 'tmp/prompt-caret-browser');
    await mkdir(fixture, { recursive: true });
    await writeFile(
      resolve(fixture, 'index.html'),
      '<!doctype html><html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
    );
    await writeFile(
      resolve(fixture, 'main.tsx'),
      `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ConversationInput} from '../../libs/conversation-input/src/components/ConversationInput/ConversationInput';
const initial = new URLSearchParams(location.search).get('initial');
function App(){
 const [seed,setSeed]=useState({text:initial ?? undefined,revision:initial?1:0});
 const [insertion,setInsertion]=useState({text:'',revision:0});
 window.seedComposer=(text)=>setSeed(prev=>({text,revision:prev.revision+1}));
 window.insertIntoComposer=(text)=>setInsertion(prev=>({text,revision:prev.revision+1}));
 return <ConversationInput onSend={()=>{}} message={seed.text} messageRevision={seed.revision} textInsertion={insertion} autoFocus={new URLSearchParams(location.search).get('autofocus')==='1'} />;
}
createRoot(document.getElementById('root')).render(<App/>);
`,
    );
    await build({
      configFile: false,
      root: fixture,
      logLevel: 'error',
      resolve: {
        conditions: [
          '@epam/source',
          'module',
          'browser',
          'development|production',
        ],
      },
      build: { outDir: resolve(fixture, 'dist'), minify: false },
    });
    const app = express();
    app.use(express.static(resolve(fixture, 'dist')));
    const server = await new Promise((resolveServer) => {
      const instance = app.listen(0, '127.0.0.1', () =>
        resolveServer(instance),
      );
    });
    let browser;
    try {
      browser = await chromium.launch();
      const page = await browser.newPage();
      const origin = `http://127.0.0.1:${server.address().port}/`;

      const textarea = page.locator('textarea');
      const insertSummary = async () => {
        await page.evaluate(() => window.insertIntoComposer('Summarize this'));
        await page.waitForFunction(() =>
          document.querySelector('textarea')?.value.includes('Summarize'),
        );
        return textarea.inputValue();
      };

      for (const autofocus of ['0', '1']) {
        await page.goto(
          `${origin}?autofocus=${autofocus}&initial=${encodeURIComponent('/my-skill ')}`,
        );
        await textarea.waitFor({ state: 'attached' });
        assert.equal(
          await insertSummary(),
          '/my-skill Summarize this',
          `composer mounted with the mention already in it (autofocus=${autofocus})`,
        );

        await page.goto(`${origin}?autofocus=${autofocus}`);
        await textarea.waitFor({ state: 'attached' });
        await page.evaluate(() => window.seedComposer('/my-skill '));
        await page.waitForFunction(
          () => document.querySelector('textarea')?.value === '/my-skill ',
        );
        assert.equal(
          await insertSummary(),
          '/my-skill Summarize this',
          `mention seeded after the composer had mounted (autofocus=${autofocus})`,
        );
      }
    } finally {
      await browser?.close();
      server.close();
    }
  },
);

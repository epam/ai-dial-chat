import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import express from 'express';
import { chromium } from 'playwright';
import { build } from 'vite';
import tailwindcss from 'tailwindcss';

const workspace = resolve(import.meta.dirname, '../../..');
const require = createRequire(import.meta.url);
const DEPTH = 6;

/*
 * Real `StagesPanel` + kit `Accordion` + `AttachmentCard`, built from source
 * into an ignored `tmp/` fixture. Checks what jsdom cannot: rendered width,
 * capped indentation, direction and touch-target geometry.
 */
test(
  'nested stages stay usable at every width in both directions',
  { timeout: 240_000 },
  async () => {
    const fixture = resolve(workspace, 'tmp/nested-stages-browser');
    await mkdir(fixture, { recursive: true });
    await writeFile(
      resolve(fixture, 'index.html'),
      '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
    );
    await writeFile(
      resolve(fixture, 'main.css'),
      '@tailwind base; @tailwind components; @tailwind utilities; body{margin:0;background:#fff;color:#161b2d} #root{padding:16px;box-sizing:border-box}',
    );
    await writeFile(
      resolve(fixture, 'main.tsx'),
      `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {StagesPanel} from '../../libs/conversation-stages/src/components/StagesPanel/StagesPanel';
import '@epam/ai-dial-ui-kit/styles.css';
import './main.css';
const query=new URLSearchParams(location.search);
document.documentElement.dir=query.get('dir') || 'ltr';
document.documentElement.lang=query.get('dir')==='rtl'?'ar':'en';
const long='Retrieve and cross-check an exceptionally long nested operation label that must truncate instead of widening the page';
const stages=Array.from({length:${DEPTH}},(_,index)=>({
  index,
  name:'Level '+index+' '+long,
  status:'completed',
  ...(index>0 && {parent_stage_index:index-1}),
  content:'Output of level '+index+'\\n\\n\`\`\`\\n'+'x'.repeat(400)+'\\n\`\`\`',
  attachments:[{title:'result-'+index+'.md',type:'text/markdown',data:'# Result '+index}],
}));
stages.push(
  {index:${DEPTH},name:'Retry',status:'failed',parent_stage_index:0},
  {index:${DEPTH + 1},name:'Retry',status:'completed',parent_stage_index:0},
);
createRoot(document.getElementById('root')).render(
  <StagesPanel stages={stages} isStreaming={false} onAttachmentClick={(a)=>{window.clicked=(window.clicked||[]).concat(a.name);}} />,
);
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
      css: {
        postcss: {
          plugins: [
            tailwindcss({
              presets: [require(resolve(workspace, 'tailwind.config.js'))],
              content: [
                ...[
                  'conversation-stages',
                  'attachment-input',
                  'chat-shared',
                ].map((lib) =>
                  resolve(workspace, `libs/${lib}/src/**/*.{ts,tsx}`),
                ),
                resolve(fixture, 'main.tsx'),
              ].map((path) => path.replaceAll('\\', '/')),
            }),
          ],
        },
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
    const evidence = [];
    try {
      browser = await chromium.launch();
      const page = await browser.newPage();
      for (const dir of ['ltr', 'rtl'])
        for (const width of [360, 900, 1280, 1920]) {
          const context = JSON.stringify({ dir, width });
          await page.setViewportSize({ width, height: 900 });
          await page.goto(
            `http://127.0.0.1:${server.address().port}/?dir=${dir}`,
          );
          const header = (level) =>
            page.getByRole('button', { name: new RegExp(`^Level ${level} `) });
          await header(0).waitFor();

          /* Expand the chain from the keyboard, level by level. */
          for (let level = 0; level < DEPTH; level += 1) {
            await header(level).focus();
            await page.keyboard.press(level % 2 ? 'Space' : 'Enter');
            assert.equal(
              await header(level).getAttribute('aria-expanded'),
              'true',
              context,
            );
          }
          await page.getByRole('button', { name: /Retry\s*×2/ }).click();
          await page.getByText(`Output of level ${DEPTH - 1}`).waitFor();

          const geometry = await page.evaluate((depth) => {
            const box = (element) => {
              const r = element.getBoundingClientRect();
              return {
                left: r.left,
                right: r.right,
                width: r.width,
                height: r.height,
              };
            };
            const headers = [...document.querySelectorAll('button')].filter(
              (button) => /Level \d /.test(button.textContent ?? ''),
            );
            return {
              scrollWidth: document.documentElement.scrollWidth,
              innerWidth: window.innerWidth,
              headers: headers.slice(0, depth).map(box),
              disclosures: [
                ...document.querySelectorAll('button[aria-expanded]'),
              ].map(box),
              attachments: [
                ...document.querySelectorAll(
                  '[role="button"][aria-label="Preview search result"]',
                ),
              ].map(box),
            };
          }, DEPTH);
          evidence.push({ dir, width, geometry });

          assert.ok(
            geometry.scrollWidth <= geometry.innerWidth,
            `page overflows ${context}: ${geometry.scrollWidth}`,
          );
          assert.equal(geometry.headers.length, DEPTH, context);
          assert.equal(geometry.attachments.length, DEPTH, context);
          for (const control of [
            ...geometry.headers,
            ...geometry.attachments,
          ]) {
            assert.ok(
              control.left >= -1 && control.right <= width + 1,
              `${context} ${JSON.stringify(control)}`,
            );
          }

          /* Indentation starts on the inline-start edge and stops after level three. */
          const start = geometry.headers.map((h) =>
            dir === 'rtl' ? width - h.right : h.left,
          );
          for (let level = 1; level <= 3; level += 1)
            assert.ok(start[level] > start[level - 1], `${context} ${start}`);
          for (let level = 4; level < DEPTH; level += 1)
            assert.ok(
              Math.abs(start[level] - start[3]) <= 1,
              `${context} ${start}`,
            );

          if (width < 1280) {
            for (const control of [
              ...geometry.disclosures,
              ...geometry.attachments,
            ])
              assert.ok(
                control.width >= 44 && control.height >= 44,
                `${context} ${JSON.stringify(control)}`,
              );
          }

          /* A grandchild attachment reaches the host callback. */
          await page
            .getByRole('button', { name: 'Preview search result' })
            .nth(DEPTH - 1)
            .click();
          assert.deepEqual(
            await page.evaluate(() => window.clicked),
            [`result-${DEPTH - 1}.md`],
            context,
          );

          /* Collapsing the root keeps focus on it and Tab skips the hidden subtree. */
          await header(0).focus();
          await page.keyboard.press('Enter');
          assert.equal(
            await header(0).getAttribute('aria-expanded'),
            'false',
            context,
          );
          assert.equal(
            await header(0).evaluate((el) => document.activeElement === el),
            true,
            context,
          );
          await page.keyboard.press('Tab');
          assert.equal(
            await page.evaluate(() => {
              const active = document.activeElement;
              return !!active?.closest('[inert]');
            }),
            false,
            context,
          );
        }
      await writeFile(
        resolve(fixture, 'geometry.json'),
        JSON.stringify(evidence, null, 2),
      );
    } finally {
      await browser?.close();
      await new Promise((resolveClose) => server.close(resolveClose));
    }
  },
);

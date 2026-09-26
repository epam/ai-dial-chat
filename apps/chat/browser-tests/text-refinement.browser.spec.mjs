import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import express from 'express';
import { chromium } from 'playwright';
import { build } from 'vite';
import tailwindcss from 'tailwindcss';

const workspace = resolve(import.meta.dirname, '../../..');
const require = createRequire(import.meta.url);

test('standalone refinement text fallbacks meet 7:1 contrast', async () => {
  const luminance = (hex) => {
    const channels = hex
      .match(/[a-f\d]{2}/gi)
      .map((part) => parseInt(part, 16) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  for (const file of [
    'libs/skill-editor/src/components/SkillEditor/SkillEditor.module.scss',
    'libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.module.scss',
  ]) {
    const styles = await readFile(resolve(workspace, file), 'utf8');
    const fallbacks = [
      ...styles
        .slice(styles.indexOf('.refineAction'))
        .matchAll(/#[a-f\d]{6}/gi),
    ].map((match) => match[0]);
    assert.equal(fallbacks.length, 2);
    for (const color of fallbacks)
      for (const background of ['#ffffff', '#eef1f7'])
        assert.ok(
          (luminance(background) + 0.05) / (luminance(color) + 0.05) >= 7,
          `${file}: ${color} on ${background}`,
        );
  }
});

test(
  'refinement controls wrap and remain operable in both directions',
  { timeout: 180_000 },
  async () => {
    const fixture = resolve(workspace, 'tmp/text-refinement-browser');
    await mkdir(fixture, { recursive: true });
    await writeFile(
      resolve(fixture, 'index.html'),
      '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
    );
    await writeFile(
      resolve(fixture, 'main.css'),
      '@tailwind base; @tailwind components; @tailwind utilities; body{margin:0;background:#fff;color:#161b2d} #root{min-height:100vh;display:flex;flex-direction:column}',
    );
    await writeFile(
      resolve(fixture, 'main.tsx'),
      `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SkillEditor} from '../../libs/skill-editor/src/components/SkillEditor/SkillEditor';
import {ScheduledTaskCreateForm} from '../../libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm';
import '@epam/ai-dial-ui-kit/styles.css';
import '@epam/ai-dial-react-file-manager/styles.css';
import './main.css';
const query=new URLSearchParams(location.search);
document.documentElement.dir=query.get('dir') || 'ltr';
document.documentElement.lang=query.get('dir')==='rtl'?'ar':'en';
const labels={descriptionLabel:'Description',instructionsLabel:'Instructions',refineWithAiLabel:query.get('dir')==='rtl'?'تحسين النص باستخدام الذكاء الاصطناعي':'Refine with AI',refineUndoLabel:'Undo'};
const refine=(text,signal)=>new Promise(resolve=>{window.finishRefinement=()=>resolve(text+' refined');window.refinementSignal=signal;});
function App(){
 const [values,setValues]=useState({displayName:'Task',description:'Original',prompt:'# Instructions',modelId:'model',repeat:'hourly',minute:'0',time:'09:00'});
 return query.get('form')==='skill'?<SkillEditor title="Skill" labels={{...labels,createLabel:'Save'}} initialValues={{name:'skill',description:'Original',instructions:'# Instructions'}} files={[]} fileActions={{validateBatch:async()=>({results:[],batchErrors:[]}),commitBatch:async()=>({}),onRemoveNode:()=>{}}} onBack={()=>{}} onCancel={()=>{}} onSubmit={()=>{}} onRefineDescription={refine} onRefineInstructions={refine} />:<ScheduledTaskCreateForm labels={{...labels,pageTitle:'Task',backButtonLabel:'Back',detailsSectionTitle:'Details',detailsSectionSubtitle:'Details',configurationSectionTitle:'Configuration',configurationSectionSubtitle:'Configuration',displayNameLabel:'Name',repeatLabel:'Repeat',repeatOptions:[{key:'hourly',label:'Hourly'}],minuteLabel:'Minute',startDateLabel:'Start',endDateLabel:'End',cancelButtonLabel:'Cancel',createButtonLabel:'Save'}} values={values} errors={{}} modelSelector={null} modelLabelId="model" onFieldChange={(key,value)=>setValues(prev=>({...prev,[key]:value}))} onBack={()=>{}} onCancel={()=>{}} onSubmit={()=>{}} onRefineDescription={refine} onRefineInstructions={refine} />;
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
      css: {
        postcss: {
          plugins: [
            tailwindcss({
              presets: [require(resolve(workspace, 'tailwind.config.js'))],
              content: [
                'skill-editor',
                'scheduled-tasks',
                'builder-form',
                'chat-shared',
              ].map((lib) =>
                resolve(workspace, `libs/${lib}/src/**/*.{ts,tsx}`).replaceAll(
                  '\\',
                  '/',
                ),
              ),
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
      for (const form of ['skill', 'task'])
        for (const dir of ['ltr', 'rtl'])
          for (const width of [360, 900, 1280, 1920]) {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(
              `http://127.0.0.1:${server.address().port}/?form=${form}&dir=${dir}`,
            );
            const group = page.getByRole('group', {
              name: 'Description',
              exact: true,
            });
            const refine = group.getByRole('button').first();
            await refine.waitFor();
            const checkGeometry = async () => {
              const boxes = await page
                .locator('[class*="-refine-action"]')
                .evaluateAll((buttons) =>
                  buttons.map((button) => {
                    const r = button.getBoundingClientRect();
                    return {
                      x: r.x,
                      y: r.y,
                      width: r.width,
                      height: r.height,
                      scroll: button.scrollWidth,
                      client: button.clientWidth,
                    };
                  }),
                );
              for (const box of boxes) {
                assert.ok(
                  box.width >= 44 && box.height >= 44,
                  JSON.stringify({ form, dir, width, box }),
                );
                assert.ok(
                  box.x >= -1 && box.x + box.width <= width + 1,
                  JSON.stringify({ form, dir, width, box }),
                );
                assert.ok(
                  box.scroll <= box.client + 1,
                  JSON.stringify({ form, dir, width, box }),
                );
              }
              return boxes;
            };
            await checkGeometry();
            await refine.focus();
            await page.keyboard.press('Enter');
            assert.equal(await refine.isDisabled(), true);
            assert.equal(
              await group.locator('textarea').getAttribute('readonly'),
              null,
            );
            await page.evaluate(() => window.finishRefinement());
            const undo = group.getByRole('button', {
              name: 'Undo',
              exact: true,
            });
            await undo.waitFor();
            evidence.push({ form, dir, width, boxes: await checkGeometry() });
            await undo.click();
            assert.equal(
              await group.locator('textarea').inputValue(),
              'Original',
            );
            assert.equal(
              await refine.evaluate(
                (button) => document.activeElement === button,
              ),
              true,
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

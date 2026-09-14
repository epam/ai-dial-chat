import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import express from 'express';
import { strToU8, zipSync } from 'fflate';
import helmet from 'helmet';
import { chromium } from 'playwright';
import ts from 'typescript';
import { build } from 'vite';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);

const zip = (files) =>
  zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [path, strToU8(content)]),
    ),
  );

test(
  'strict CSP preserves installed renderers and rejects unapproved code',
  { timeout: 120_000 },
  async () => {
    await mkdir(join(workspace, 'tmp'), { recursive: true });
    const fixture = await mkdtemp(join(workspace, 'tmp', 'csp-browser-'));
    let browser;
    let server;
    try {
      const output = join(fixture, 'dist');
      await writeFile(
        join(fixture, 'index.html'),
        '<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
      );
      await writeFile(
        join(fixture, 'style.css'),
        'body{margin:0}.grid{height:240px;width:100%}.viewer{height:300px;width:100%}',
      );
      await writeFile(
        join(fixture, 'main.tsx'),
        `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {Grid} from '@epam/ai-dial-ui-kit/grid';
      import {DialFileManager, DialFileNodeType} from '@epam/ai-dial-react-file-manager';
      import '@epam/ai-dial-ui-kit/styles.css';
      import '@epam/ai-dial-react-file-manager/styles.css';
      import './style.css';
      import {GlobalWorkerOptions} from 'pdfjs-dist';
      import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
      GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const wasm = new Uint8Array([0,97,115,109,1,0,0,0]);
      window.security = {};
      const checkSecurity = async () => {
        const style=document.createElement('style');
        style.textContent='body{background:rgb(255,0,0)}'; document.head.append(style);
        const wrong=document.createElement('style'); wrong.nonce='wrong';
        wrong.textContent='body{background:rgb(255,0,0)}'; document.head.append(wrong);
        const inline=document.createElement('script'); inline.textContent='window.inlineRan=true'; document.body.append(inline);
        const attr=document.createElement('div'); attr.id='attribute'; attr.setAttribute('style','color:rgb(255,0,0)'); document.body.append(attr);
        const handler=document.createElement('button'); handler.setAttribute('onclick','window.handlerRan=true'); document.body.append(handler); handler.click();
        try { new Function('return true')(); window.security.eval=true; } catch { window.security.eval=false; }
        try { await WebAssembly.compile(wasm); window.security.wasm=true; } catch { window.security.wasm=false; }
        window.security.done=true;
      };
      const container = () => { const el=document.createElement('div'); el.className='viewer'; document.body.append(el); return el; };
      window.renderXlsx = async () => {
        const {XlsxViewer}=await import('@silurus/ooxml/xlsx');
        const viewer=new XlsxViewer(container()); await viewer.load('/assets/test.xlsx');
        return true;
      };
      window.renderDocx = async () => {
        const {DocxScrollViewer}=await import('@silurus/ooxml/docx');
        const viewer=new DocxScrollViewer(container(), {enableTextSelection:true});
        await viewer.load('/assets/test.docx'); return true;
      };
      window.renderPdf = async () => {
        const {getDocument}=await import('pdfjs-dist');
        const pdf=await getDocument('/assets/test.pdf').promise;
        const page=await pdf.getPage(1); const canvas=document.createElement('canvas');
        const viewport=page.getViewport({scale:1}); canvas.width=viewport.width; canvas.height=viewport.height;
        container().append(canvas); await page.render({canvas,viewport}).promise; await pdf.destroy(); return true;
      };
      createRoot(document.getElementById('root')).render(<><Grid className="grid" rowData={[{id:'1',name:'Example'}]} columnDefs={[{field:'name'}]}/><DialFileManager className="viewer" path="files/" items={[{nodeType:DialFileNodeType.FOLDER,path:'files/',name:'files',folderId:'/',items:[{nodeType:DialFileNodeType.ITEM,path:'files/sample.txt',name:'sample.txt',folderId:'files/',parentPath:'files/'}]}]}/><button onClick={checkSecurity}>Check CSP</button></>);
    `,
      );
      await build({
        configFile: join(workspace, 'apps/chat/vite.config.mts'),
        root: fixture,
        logLevel: 'error',
        build: { outDir: output, reportCompressedSize: false },
      });

      for (const path of ['config/csp', 'app/static-assets']) {
        const source = await readFile(
          join(workspace, `apps/chat-api/src/${path}.ts`),
          'utf8',
        );
        const destination = join(fixture, 'backend', `${path}.js`);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(
          destination,
          ts.transpileModule(source, {
            compilerOptions: {
              module: ts.ModuleKind.CommonJS,
              target: ts.ScriptTarget.ES2022,
              esModuleInterop: true,
            },
          }).outputText,
        );
      }
      const { createFrontendMiddleware } = require(
        join(fixture, 'backend/app/static-assets.js'),
      );
      const { createHelmetOptions, CspMode } = require(
        join(fixture, 'backend/config/csp.js'),
      );
      const types =
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>';
      const relationships = (target) =>
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${target}"/></Relationships>`;
      await writeFile(
        join(output, 'assets/test.docx'),
        zip({
          '[Content_Types].xml': `${types}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
          '_rels/.rels': relationships('word/document.xml'),
          'word/document.xml':
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>CSP document preview</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>',
        }),
      );
      await writeFile(
        join(output, 'assets/test.xlsx'),
        zip({
          '[Content_Types].xml': `${types}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
          '_rels/.rels': relationships('xl/workbook.xml'),
          'xl/workbook.xml':
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
          'xl/_rels/workbook.xml.rels':
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
          'xl/worksheets/sheet1.xml':
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>CSP workbook</t></is></c></row></sheetData></worksheet>',
          'xl/styles.xml':
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>',
          'xl/sharedStrings.xml':
            '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"/>',
        }),
      );
      const pdfDrawing = '0 0 50 50 re\nf\n';
      const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>',
        `<< /Length ${Buffer.byteLength(pdfDrawing)} >>\nstream\n${pdfDrawing}endstream`,
      ];
      let pdf = '%PDF-1.4\n';
      const offsets = [0];
      for (const [index, object] of objects.entries()) {
        offsets.push(Buffer.byteLength(pdf));
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
      }
      const xref = Buffer.byteLength(pdf);
      pdf += `xref\n0 5\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
        .join(
          '',
        )}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      await writeFile(join(output, 'assets/test.pdf'), pdf);

      const app = express();
      app.use(helmet(createHelmetOptions([], false)));
      app.use(
        await createFrontendMiddleware({
          frontendRootPath: output,
          secureTransport: false,
          cspMode: CspMode.Enforce,
        }),
      );
      server = await new Promise((resolve) => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      });
      const origin = `http://127.0.0.1:${server.address().port}`;
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.addInitScript(() => {
        window.violations = [];
        document.addEventListener('securitypolicyviolation', (event) =>
          window.violations.push(event.effectiveDirective),
        );
      });
      await page.goto(origin);
      await page.getByRole('gridcell', { name: 'Example' }).waitFor();
      await page
        .getByRole('gridcell', { name: /sample/ })
        .first()
        .waitFor({ timeout: 5000 })
        .catch(async (error) => {
          throw new Error(
            `${error.message}\n${await page.locator('body').innerText()}`,
          );
        });
      for (const [width, direction] of [
        [1280, 'ltr'],
        [360, 'rtl'],
      ]) {
        await page.setViewportSize({ width, height: 800 });
        await page.evaluate((dir) => {
          document.documentElement.dir = dir;
        }, direction);
        const bounds = await page
          .getByRole('gridcell', { name: 'Example' })
          .boundingBox();
        assert.ok(bounds && bounds.width > 0 && bounds.height > 0);
      }
      assert.equal(await page.evaluate(() => window.renderXlsx()), true);
      assert.equal(await page.evaluate(() => window.renderDocx()), true);
      assert.equal(await page.evaluate(() => window.renderPdf()), true);
      const styles = await page.evaluate(() =>
        [...document.querySelectorAll('style')].map((style) => ({
          nonce: style.nonce,
          applied: style.sheet != null,
          owner: [...style.attributes].map((attr) => attr.name).join(','),
          prefix: style.textContent.slice(0, 80),
        })),
      );
      assert.deepEqual(
        await page.evaluate(() => window.violations),
        [],
        JSON.stringify(styles),
      );
      assert.ok(styles.length > 0);
      assert.ok(styles.every((style) => style.applied));

      await page.getByRole('button', { name: 'Check CSP' }).click();
      await page.waitForFunction(() => window.security.done);
      const security = await page.evaluate(() => ({
        ...window.security,
        inlineRan: window.inlineRan === true,
        handlerRan: window.handlerRan === true,
        redBackground:
          getComputedStyle(document.body).backgroundColor === 'rgb(255, 0, 0)',
        redAttribute:
          getComputedStyle(document.getElementById('attribute')).color ===
          'rgb(255, 0, 0)',
        violations: [...new Set(window.violations)],
      }));
      assert.equal(security.eval, false);
      assert.equal(security.wasm, true);
      assert.equal(security.inlineRan, false);
      assert.equal(security.handlerRan, false);
      assert.equal(security.redBackground, false);
      assert.equal(security.redAttribute, false);
      assert.ok(security.violations.includes('style-src-elem'));
      assert.ok(security.violations.includes('script-src-elem'));
    } finally {
      await browser?.close();
      if (server) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      await rm(fixture, { recursive: true, force: true });
    }
  },
);

import assert from 'node:assert/strict';
import { validateScheduledTaskFormValues } from '@epam/ai-dial-scheduled-tasks/validation';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
for (const name of ['scheduled-tasks', 'catalog', 'chat-hooks']) {
  const entry = realpathSync(require.resolve('@epam/ai-dial-' + name));
  assert(
    entry.startsWith(realpathSync(resolve(root, 'node_modules'))),
    'Must load an installed tarball: ' + entry,
  );
}
assert.equal(typeof validateScheduledTaskFormValues, 'function');
execFileSync(
  process.execPath,
  [
    require.resolve('typescript/bin/tsc'),
    '-p',
    resolve(root, 'tsconfig.consumer.json'),
  ],
  { stdio: 'inherit' },
);

const server = await preview({
  configFile: resolve(root, 'vite.config.mts'),
  preview: { host: '127.0.0.1', port: 0, open: false },
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const address = server.httpServer.address();
  await page.goto('http://127.0.0.1:' + address.port);
  const form = page.getByRole('region', {
    name: 'Scheduled task form',
    exact: true,
  });
  await form
    .getByPlaceholder('Write instructions')
    .waitFor()
    .catch((error) => {
      assert.deepEqual(errors, [], 'Packed page runtime errors');
      throw error;
    });
  const grid = page
    .getByRole('region', { name: 'Responsive cards' })
    .locator('.dial-scheduled-tasks-card-grid');
  for (const [width, columns] of [
    [1000, 3],
    [600, 2],
    [280, 1],
  ]) {
    await grid.evaluate((element, width) => {
      element.style.width = width + 'px';
    }, width);
    const measured = await grid.evaluate((element) => ({
      columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
      width: element.clientWidth,
      scroll: element.scrollWidth,
      heights: Array.from(element.children).map((child) =>
        Math.round(child.getBoundingClientRect().height),
      ),
    }));
    assert.equal(measured.columns, columns, JSON.stringify(measured));
    assert(measured.scroll <= measured.width + 1, JSON.stringify(measured));
    assert(
      measured.heights.every((height) => height === 190),
      JSON.stringify(measured),
    );
  }
  await grid.evaluate((element) => {
    element.style.width = '100%';
  });
  const border = await form
    .getByRole('button', { name: 'Back', exact: true })
    .evaluate((element) => {
      for (let node = element.parentElement; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (
          parseFloat(style.borderBottomWidth) ||
          parseFloat(style.borderTopWidth)
        )
          return style.borderBottomColor;
      }
      return null;
    });
  assert.equal(border, 'rgb(111, 112, 115)');
  assert.notEqual(
    await page
      .locator('.header')
      .evaluate((element) => getComputedStyle(element).borderBottomColor),
    'rgb(111, 112, 115)',
  );
  await form.getByRole('combobox').first().click();
  await page
    .getByRole('option', { name: 'Model B with a deliberately long label' })
    .click();
  assert.equal(
    await form.getByRole('combobox').first().inputValue(),
    'Model B with a deliberately long label',
  );
  await form.getByRole('combobox').first().click();
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page
    .getByRole('button', { name: 'Cancel', exact: true })
    .last()
    .click();
  for (const width of [1280, 900, 375]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.waitForTimeout(150);
    assert(
      await form.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
      'Form overflow at ' + width,
    );
  }
  const detail = page.getByRole('region', {
    name: 'Scheduled task detail',
    exact: true,
  });
  const dashboardCreate = page
    .getByRole('button', { name: 'Create', exact: true })
    .first();
  const snapshot = async () => ({
    createLabelVisible: await dashboardCreate
      .getByText('Create', { exact: true })
      .isVisible(),
    createWidth: Math.round(
      await dashboardCreate.evaluate(
        (element) => element.getBoundingClientRect().width,
      ),
    ),
    visibleDetailTitles: await detail
      .getByRole('heading', { name: 'Packed task', exact: true })
      .count(),
    visibleCancelButtons: await form
      .getByRole('button', { name: 'Cancel', exact: true })
      .count(),
    cancelAboveFields: await form
      .getByRole('button', { name: 'Cancel', exact: true })
      .evaluate(
        (element) =>
          element.getBoundingClientRect().top <
          document.querySelector('#fixture-model-label').getBoundingClientRect()
            .top,
      ),
    genericBuilder: await page
      .getByRole('region', { name: 'Default builder' })
      .evaluate((element) => {
        const left = element.querySelector('[data-testid="generic-left"]');
        const main = element.querySelector('[data-testid="generic-main"]');
        const body = left.parentElement.parentElement;
        const reserved = body.lastElementChild;
        return {
          direction: getComputedStyle(body).flexDirection,
          leftWidth: Math.round(left.getBoundingClientRect().width),
          reservedWidth: Math.round(reserved.getBoundingClientRect().width),
          reservedVisible: getComputedStyle(reserved).display !== 'none',
          columnsAligned:
            Math.abs(
              left.getBoundingClientRect().top -
                main.getBoundingClientRect().top,
            ) < 1,
        };
      }),
    formOverflow: await form.evaluate(
      (element) => element.scrollWidth > element.clientWidth + 1,
    ),
  });
  for (const dir of ['ltr', 'rtl']) {
    await page.evaluate((dir) => {
      document.documentElement.dir = dir;
    }, dir);
    for (const width of [360, 900, 1279, 1280, 1920]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.waitForTimeout(100);
      const expected = await snapshot();
      assert.equal(expected.createLabelVisible, width >= 1280);
      assert.equal(expected.visibleDetailTitles, 1);
      assert.equal(expected.visibleCancelButtons, 1);
      assert.equal(expected.cancelAboveFields, width >= 1280);
      assert.equal(expected.formOverflow, false);
      assert.equal(
        expected.genericBuilder.direction,
        width >= 1280 ? 'row' : 'column',
      );
      assert.equal(expected.genericBuilder.reservedVisible, width >= 1280);
      if (width >= 1280) {
        assert.equal(expected.genericBuilder.leftWidth, 400);
        assert.equal(expected.genericBuilder.reservedWidth, 400);
        assert.equal(expected.genericBuilder.columnsAligned, true);
      }
      for (const breakpoint of [769, 1280]) {
        for (const order of ['before', 'after']) {
          await page.evaluate(
            ({ breakpoint, order }) => {
              const sheet = document.createElement('style');
              sheet.id = 'fixture-host-utilities';
              sheet.textContent = String.raw`
              .hidden { display: none }
              @media (min-width: ${breakpoint}px) {
                .desktop\:inline { display: inline }
                .desktop\:block { display: block }
                .desktop\:flex { display: flex }
                .desktop\:hidden { display: none }
                .desktop\:flex-row { flex-direction: row }
                .desktop\:px-8 { padding-inline: 32px }
                .desktop\:border-t-0 { border-top-width: 0 }
                .desktop\:border-b { border-bottom-width: 1px }
              }
            `;
              if (order === 'before') document.head.prepend(sheet);
              else document.head.append(sheet);
            },
            { breakpoint, order },
          );
          assert.deepEqual(
            await snapshot(),
            expected,
            JSON.stringify({ width, dir, breakpoint, order }),
          );
          await page
            .locator('#fixture-host-utilities')
            .evaluate((element) => element.remove());
        }
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS packed runtime imports, isolated TypeScript, responsive grid/skeletons, scoped CSS, editor placeholder, selector, deletion flow, host CSS order/breakpoint isolation and RTL',
  );
} finally {
  await browser.close();
  await new Promise((done, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : done())),
  );
}

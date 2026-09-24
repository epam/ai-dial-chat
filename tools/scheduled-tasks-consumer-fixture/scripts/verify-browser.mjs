import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({
  preview: { host: '127.0.0.1', port: 0, open: false },
});
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  const address = server.httpServer.address();
  assert(address && typeof address !== 'string');
  await page.goto(`http://127.0.0.1:${address.port}`);
  const trigger = page.getByRole('combobox', {
    name: 'Skill',
    exact: true,
  });
  await trigger.click();
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  assert.equal(await trigger.inputValue(), 'skills/public/report');
  await trigger.click();
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await page.getByRole('button', { name: 'Select long skill' }).click();
  const field = page.locator('.dial-skills-selector-field');
  await field.getByRole('button', { name: 'Remove skill' }).waitFor();
  for (const width of [360, 900, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dir of ['ltr', 'rtl']) {
      await page.evaluate((direction) => {
        document.documentElement.dir = direction;
      }, dir);
      await page.waitForTimeout(100);
      const bounds = await field.boundingBox();
      assert(
        bounds && bounds.x >= 0 && bounds.x + bounds.width <= width,
        `Skill fits ${width}px ${dir}`,
      );
      assert(
        await field.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
        `Skill does not overflow ${width}px ${dir}`,
      );
      const remove = await field
        .getByRole('button', { name: 'Remove skill' })
        .boundingBox();
      assert(
        remove && remove.width >= 44 && remove.height >= 44,
        'Touch removal target is at least 44px',
      );
      await trigger.click();
      const menu = page.getByRole('dialog', { name: 'Skill', exact: true });
      await menu.waitFor();
      const menuBounds = await menu.boundingBox();
      assert(
        menuBounds &&
          menuBounds.x >= 0 &&
          menuBounds.x + menuBounds.width <= width,
        `Favorites fit ${width}px ${dir}`,
      );
      await page.getByRole('textbox', { name: 'Search skills' }).fill('report');
      await page.getByRole('button', { name: 'Report', exact: true }).waitFor();
      await page.waitForTimeout(250);
      await page.screenshot({
        path: '../../tmp/skill-field-' + width + '-' + dir + '.png',
      });
      await page.keyboard.press('Escape');
      const detail = page.getByRole('region', {
        name: 'Scheduled task detail',
      });
      const configurationTab = detail.getByRole('tab', {
        name: 'Configuration',
      });
      if (await configurationTab.isVisible()) await configurationTab.click();
      const savedSkill = detail.getByRole('group', {
        name: 'Skill',
        exact: true,
      });
      await savedSkill.waitFor();
      assert.match(await savedSkill.innerText(), /skills\//);
      const detailBounds = await savedSkill.boundingBox();
      assert(
        detailBounds &&
          detailBounds.x >= 0 &&
          detailBounds.x + detailBounds.width <= width,
        `Saved skill fits ${width}px ${dir}`,
      );
      assert(
        await savedSkill.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
        `Saved skill does not overflow ${width}px ${dir}`,
      );
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await trigger.click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('aria-haspopup') === 'dialog',
  );
  await field.getByRole('button', { name: 'Remove skill' }).click();
  await trigger.waitFor();
  await trigger.click();
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  const model = page
    .getByRole('region', { name: 'Scheduled task form' })
    .getByRole('combobox', { name: /^Model/ });
  await model.click();
  await page
    .getByRole('option', { name: 'Model B with a deliberately long label' })
    .click();
  assert(
    await trigger.isDisabled(),
    'Unsupported model disables skill selection',
  );
  await field.getByRole('button', { name: 'Remove skill' }).click();
  assert.equal(
    await trigger.inputValue(),
    '',
    'Unsupported skill remains removable',
  );
  assert.equal(
    await page.getByRole('button', { name: 'Remove skill' }).count(),
    0,
  );
  assert.deepEqual(failures, []);
  console.log(
    'PASS packed favorites, catalog, clear, detail, focus, LTR/RTL and 360/900/1280/1920px layout',
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

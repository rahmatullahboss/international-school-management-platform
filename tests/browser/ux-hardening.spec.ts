import { expect, test, type Page } from '@playwright/test';

const walkthroughRoles = [
  'admin',
  'teacher',
  'guardian',
  'student',
  'admissions',
  'finance',
  'support',
] as const;

async function suppressWalkthrough(page: Page): Promise<void> {
  await page.addInitScript((roles) => {
    for (const role of roles) {
      window.localStorage.setItem(`school-platform:walkthrough:v1:${role}`, 'complete');
    }
  }, walkthroughRoles);
}

async function expectNoDocumentOverflow(page: Page, route: string): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));

  expect(dimensions.document, `${route} document overflow`).toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
  expect(dimensions.body, `${route} body overflow`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('core and operator task routes reflow at a narrow mobile viewport', async ({ page }) => {
  await suppressWalkthrough(page);
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of [
    '/admin/academics',
    '/teacher/gradebook',
    '/family/documents',
    '/student/resources',
    '/admissions/applications',
    '/finance/reconciliation',
    '/support/access',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('main').first(), route).toBeVisible();
    await expectNoDocumentOverflow(page, route);
  }
});

test('wide operational routes reflow at 640 CSS pixels for 200 percent zoom use', async ({
  page,
}) => {
  await suppressWalkthrough(page);
  await page.setViewportSize({ width: 640, height: 900 });

  for (const route of [
    '/admin/academics',
    '/admissions/applications',
    '/finance/reconciliation',
    '/support/tenants',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('main').first(), route).toBeVisible();
    await expectNoDocumentOverflow(page, route);
  }
});

test('representative core and operator task routes remain usable in RTL direction', async ({
  page,
}) => {
  await suppressWalkthrough(page);
  await page.setViewportSize({ width: 1024, height: 900 });

  for (const route of ['/family/documents', '/support/access']) {
    await page.goto(route);
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    await expect(page.getByRole('main').first(), route).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).direction), route).toBe('rtl');
    await expectNoDocumentOverflow(page, route);
    await expect(page.getByRole('link', { name: 'Change role' }), route).toBeVisible();
  }
});

test('keyboard users can activate the skip link and focus the main role chooser content', async ({
  page,
}) => {
  await page.goto('/');

  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/#main-content$/u);
  await expect(page.locator('#main-content')).toBeFocused();
});

test('long translated task content wraps at narrow width without obscuring controls', async ({
  page,
}) => {
  await suppressWalkthrough(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const longLabel =
    'Schüleranwesenheitsüberprüfungsdokumentationsverantwortlichkeit 学籍情報確認と保護者連絡のための詳細な操作説明';

  for (const route of ['/teacher/attendance', '/family/documents', '/student/resources']) {
    await page.goto(route);
    const main = page.locator('#experience-main');
    await expect(main, route).toBeVisible();

    const textTarget = main.locator('h2, h3, p').first();
    await textTarget.evaluate((element, replacement) => {
      element.textContent = replacement;
    }, longLabel);

    const layout = await textTarget.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        left: rect.left,
        right: rect.right,
        viewport: document.documentElement.clientWidth,
      };
    });

    expect(layout.scrollWidth, `${route} long text overflow`).toBeLessThanOrEqual(
      layout.clientWidth + 1,
    );
    expect(layout.left, `${route} long text left edge`).toBeGreaterThanOrEqual(-1);
    expect(layout.right, `${route} long text right edge`).toBeLessThanOrEqual(layout.viewport + 1);
    await expect(main.locator('a, button').first(), `${route} task control`).toBeVisible();
    await expectNoDocumentOverflow(page, route);
  }
});

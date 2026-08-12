import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

describe('packaged launch and branding contract', () => {
  it('ships a branded icon in both the renderer and installer configuration', async () => {
    await access(new URL('../assets/ding-ding-app-store.ico', import.meta.url), constants.F_OK);
    await access(new URL('../assets/ding-ding-app-store.svg', import.meta.url), constants.F_OK);
    const packageJson = JSON.parse(await read('package.json')) as { build: { icon: string; win: { icon: string }; squirrelWindows: { iconUrl: string } } };
    expect(packageJson.build.icon).toBe('assets/ding-ding-app-store.ico');
    expect(packageJson.build.win.icon).toBe('assets/ding-ding-app-store.ico');
    expect(packageJson.build.squirrelWindows.iconUrl).toMatch(/ding-ding-app-store\.ico$/);
    expect(packageJson.build.squirrelWindows.iconUrl).not.toContain('favicon.ico');
  });

  it('sets a native product identity and diagnoses renderer load failure', async () => {
    const source = await read('src/main/main.ts');
    expect(source).toContain("const PRODUCT_NAME = 'Ding Ding App Store';");
    expect(source).toContain('app.setName(PRODUCT_NAME);');
    expect(source).toContain('app.setAppUserModelId(PRODUCT_APP_ID);');
    expect(source).toContain('title: PRODUCT_NAME');
    expect(source).toContain('icon: path.join(dirname, \'..\', \'..\', \'assets\', \'ding-ding-app-store.ico\')');
    expect(source).toContain("window.webContents.on('did-fail-load'");
  });

  it('renders the same product identity in the native shell and title bar', async () => {
    const [index, app] = await Promise.all([read('index.html'), read('src/renderer/App.tsx')]);
    expect(index).toContain('<title>Ding Ding App Store</title>');
    expect(index).toContain('<link rel="icon" href="/ding-ding-app-store.svg" />');
    expect(app).toContain('titlebar-logo');
    expect(app).toContain('src="/ding-ding-app-store.svg"');
  });
});

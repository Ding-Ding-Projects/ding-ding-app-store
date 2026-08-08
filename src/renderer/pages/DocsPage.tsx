import { useMemo } from 'react';
import type { UserSettings } from '../../shared/contracts';
import { SearchBox } from '../components/SearchBox';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import { highlight, makeMatcher, useSurfaceSearch } from '../search';

export interface DocArticle { id: string; title: string; body: string; related: string }

/** Offline in-app documentation. Every shipped feature has an article here, including the new ones. */
export const docs: DocArticle[] = [
  { id: 'catalog', title: 'Catalog discovery · App 目錄', body: 'The catalog is a reviewed allowlist of public Ding Ding Projects applications. Live repository and stable-release metadata refreshes from GitHub; private repositories and infrastructure are excluded.', related: 'Update schedule · Security boundaries · Update checker' },
  { id: 'install', title: 'Verified one-click install · 驗證一按安裝', body: 'Install and Reinstall start immediately with no phrase-entry dialog. The renderer sends only the catalog app ID and install decision; the main process selects the stable asset, requires a GitHub SHA-256 digest, enforces size and origin limits, uses fixed hidden arguments, and observes the installer exit code.', related: 'One-click adapter coverage · Protected uninstall · Security boundaries' },
  { id: 'one-click', title: 'One-click adapter coverage · 一按安裝覆蓋', body: 'The common one-click dispatch is implemented, but clean-Windows adapters remain incomplete across the 24-app catalog. Seven Squirrel candidates still need per-release proof, Dim Sum Atlas needs a safe portable-archive adapter, fifteen source records need pinned disposable recipes with bounded dependency/OpenCode repair, and the Home Assistant integration needs its own reviewed route. Missing adapters fail closed instead of guessing commands.', related: 'Verified one-click install · Build from source · Verification' },
  { id: 'source', title: 'Install from source · 由 source 安裝', body: 'Source requests start in one click but remain fail-closed until a pinned per-app recipe, dependency bootstrap, disposable Windows runner, structured build/run terminal simulator, bounded automatic OpenCode bootstrap/repair, retry limits, and clean-machine proof exist. The runner cannot access arbitrary user paths or user secrets.', related: 'One-click adapter coverage · Security boundaries · Verified one-click install' },
  { id: 'uninstall', title: 'Protected uninstall · 安全解除安裝', body: 'Removal uses the exact uninstall entry recorded after install. Both key controls and the full confirmation slider are required before the action can run.', related: 'Activity history · Security boundaries' },
  { id: 'updates', title: 'Update checker · 更新檢查', body: 'Installed versions are compared with trusted stable releases. The store self-updater stages unsigned Squirrel packages but restarts only after the user chooses Restart to install update.', related: 'Update schedule · Catalog discovery' },
  { id: 'tabs', title: 'Tab navigation · 分頁導覽', body: 'The rail keeps the six pages as persistent browser-style tabs. Tabs can be pinned, grouped, reordered, searched, and reached from the keyboard: Ctrl+1 to Ctrl+6 activate a tab, Ctrl+Tab cycles, Ctrl+Shift+P pins, Ctrl+Shift+G groups, Ctrl+Shift+K focuses tab search, and Alt+Arrow reorders. When the rail runs out of room the remaining tabs move into an overflow menu; the active tab and pinned tabs always stay visible. Layout, side, label mode, height, badges, and colour bars persist in their own workspace document with reset, export, and import.', related: 'Appearance editor · Update schedule · Security boundaries' },
  { id: 'appearance', title: 'Appearance editor · 外觀編輯', body: 'Every registered element exposes background, text colour, radius, padding, text size, weight, border width, and elevation. Edit mode (Ctrl+Shift+E) selects an element by click or by keyboard focus and the side panel edits it live. Overrides are stored as CSS custom properties, validated in the main process, applied through CSSOM only, and layered above theme, density, and accent. Reset one element, reset everything, export, and import are always available. The super-confirmation, its keys and slider, the emergency exit, and the window controls are never editable or hideable.', related: 'Tab navigation · Security boundaries · Verification' },
  { id: 'schedule', title: 'Update schedule · 更新排程', body: 'A self-update check runs once at every launch and cannot be turned off; the repeat switch only controls further checks while the app stays open. Catalog refresh has its own interval with a 30-minute floor that matches the catalog cache lifetime. Quiet hours never block a check: they only hold corner notifications and summarise them once the window closes. The editor shows the last run, its exact failure message, and the next run for each task, and saving is the only thing that re-arms the timers.', related: 'Update checker · Catalog discovery · Tab navigation' },
  { id: 'security', title: 'Security boundaries · 安全邊界', body: 'The renderer is sandboxed with no Node access. It can request only typed app IDs and closed user decisions; URLs, commands, paths, dependencies, and installer arguments remain main-process-owned.', related: 'Verified one-click install · Appearance editor' },
];

export function DocsPage({ settings, openRegex, onRegexHandled }: { settings: UserSettings; openRegex: boolean; onRegexHandled(): void }) {
  const search = useSurfaceSearch('docs');
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const shown = useMemo(() => docs.filter((article) => matcher(`${article.title}\n${article.body}`)), [matcher]);

  return (
    <>
      <SearchBox surface="docs" placeholder={label(settings, 'Search documentation', '搵文件')} openBuilder={openRegex} onBuilderHandled={onRegexHandled} />
      {shown.length ? (
        <section className="docs-layout">
          <nav aria-label="Documentation articles">{shown.map((article) => <a href={`#docs-${article.id}`} key={article.id}>{article.title}</a>)}</nav>
          <div>
            {shown.map((article) => (
              <article key={article.id} id={`docs-${article.id}`} tabIndex={-1} {...el('docs-article')}>
                <h2>{highlight(search.state, article.title)}</h2>
                <p>{highlight(search.state, article.body)}</p>
                <h3>Suggested articles</h3>
                <p>{article.related}</p>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <div className="empty-state" {...el('empty-state')}><Icon>search_off</Icon><h2>{label(settings, 'No matching article', '冇配到嘅文章')}</h2><p>{label(settings, 'Clear the search to browse every offline article again.', '清除搜尋就可以再睇晒所有離線文章。')}</p></div>
      )}
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { UserSettings } from '../../shared/contracts';
import { MarkdownArticle } from '../components/MarkdownArticle';
import { SearchBox } from '../components/SearchBox';
import { el } from '../el';
import { GENERATED_DOCS } from '../generated-docs';
import { Icon } from '../icons';
import { label } from '../i18n';
import { makeMatcher, useSurfaceSearch } from '../search';

export const docs = GENERATED_DOCS;

export function DocsPage({ settings, openRegex, onRegexHandled, articleRequest, onArticleHandled }: {
  settings: UserSettings;
  openRegex: boolean;
  onRegexHandled(): void;
  articleRequest?: string | null;
  onArticleHandled?(): void;
}) {
  const search = useSurfaceSearch('docs');
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const shown = useMemo(() => docs.filter((article) => matcher(`${article.title}\n${article.titleYue}\n${article.category}\n${article.status}\n${article.summary}\n${article.body}`)), [matcher]);
  const [activeId, setActiveId] = useState(docs[0]?.id ?? '');
  const active = shown.find((article) => article.id === activeId) ?? shown[0] ?? null;

  useEffect(() => {
    if (!articleRequest || !docs.some((article) => article.id === articleRequest)) return;
    search.clear();
    setActiveId(articleRequest);
    onArticleHandled?.();
  }, [articleRequest, onArticleHandled, search]);

  useEffect(() => {
    if (shown.length && !shown.some((article) => article.id === activeId)) setActiveId(shown[0].id);
  }, [shown, activeId]);

  const activate = (id: string) => {
    setActiveId(id);
    window.setTimeout(() => window.document.getElementById(`docs-panel-${id}`)?.focus(), 0);
  };

  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
    const index = shown.findIndex((article) => article.id === id);
    let target = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') target = (index + 1) % shown.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') target = (index - 1 + shown.length) % shown.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = shown.length - 1;
    else return;
    event.preventDefault();
    const next = shown[target];
    setActiveId(next.id);
    window.document.getElementById(`docs-tab-${next.id}`)?.focus();
  };

  return (
    <>
      <SearchBox surface="docs" placeholder={label(settings, 'Search every offline article', '搵晒所有離線文章')} openBuilder={openRegex} onBuilderHandled={onRegexHandled} />
      {active ? (
        <section className="docs-layout">
          <nav className="docs-tabs" role="tablist" aria-orientation="vertical" aria-label={label(settings, 'Documentation articles', '文件文章')}>
            {shown.map((article) => (
              <button
                id={`docs-tab-${article.id}`}
                key={article.id}
                role="tab"
                aria-selected={active.id === article.id}
                aria-controls={`docs-panel-${article.id}`}
                tabIndex={active.id === article.id ? 0 : -1}
                className={active.id === article.id ? 'docs-tab active' : 'docs-tab'}
                onClick={() => activate(article.id)}
                onKeyDown={(event) => onTabKeyDown(event, article.id)}
              >
                <span>{label(settings, article.title, article.titleYue)}</span>
                <small>{article.category} · {article.status}</small>
              </button>
            ))}
          </nav>
          <article
            id={`docs-panel-${active.id}`}
            role="tabpanel"
            aria-labelledby={`docs-tab-${active.id}`}
            tabIndex={-1}
            {...el('docs-article')}
          >
            <span className={`status-pill doc-status ${active.status}`}>{active.status}</span>
            <h1>{label(settings, active.title, active.titleYue)}</h1>
            <p className="lede">{active.summary}</p>
            <MarkdownArticle article={active} onOpen={activate} />
          </article>
        </section>
      ) : (
        <div className="empty-state" {...el('empty-state')}><Icon>search_off</Icon><h2>{label(settings, 'No matching article', '冇配到嘅文章')}</h2><p>{label(settings, 'Clear the search or adjust the pattern to browse all offline documentation.', '清除搜尋或者改 pattern，就可以再睇晒離線文件。')}</p></div>
      )}
    </>
  );
}

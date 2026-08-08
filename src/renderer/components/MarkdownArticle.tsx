import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { GeneratedDocArticle } from '../generated-docs';

function articleIdFromHref(href: string): string | null {
  const match = href.match(/(?:^|\/)([a-z0-9-]+)\.md(?:#.*)?$/i);
  return match?.[1] ?? null;
}

function inline(text: string, onOpen: (id: string) => void): ReactNode[] {
  const pieces: ReactNode[] = [];
  const pattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g;
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) pieces.push(text.slice(cursor, start));
    const token = match[0];
    if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const id = link && articleIdFromHref(link[2]);
      pieces.push(id
        ? <button className="article-link" key={`link-${index}`} onClick={() => onOpen(id)}>{link?.[1]}</button>
        : <span key={`link-${index}`}>{link?.[1] ?? token}</span>);
    } else if (token.startsWith('`')) pieces.push(<code key={`code-${index}`}>{token.slice(1, -1)}</code>);
    else pieces.push(<strong key={`strong-${index}`}>{token.slice(2, -2)}</strong>);
    cursor = start + token.length;
    index += 1;
  }
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return pieces;
}

/** A deliberately small, isolated renderer for repository-authored feature Markdown. */
export function MarkdownArticle({ article, onOpen }: { article: GeneratedDocArticle; onOpen(id: string): void }) {
  const lines = article.body.replace(/\r/g, '').split('\n');
  const output: ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let key = 0;
  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(<p key={`p-${key++}`}>{inline(paragraph.join(' '), onOpen)}</p>);
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    output.push(<ul key={`ul-${key++}`}>{bullets.map((item, itemIndex) => <li key={itemIndex}>{inline(item, onOpen)}</li>)}</ul>);
    bullets = [];
  };

  for (const line of lines) {
    if (line.startsWith('# ')) continue;
    if (line.startsWith('## ')) {
      flushParagraph(); flushBullets();
      output.push(<h2 key={`h2-${key++}`}>{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      flushParagraph(); flushBullets();
      output.push(<h3 key={`h3-${key++}`}>{line.slice(4)}</h3>);
    } else if (line.startsWith('- ')) {
      flushParagraph();
      bullets.push(line.slice(2));
    } else if (!line.trim()) {
      flushParagraph(); flushBullets();
    } else paragraph.push(line.trim());
  }
  flushParagraph(); flushBullets();
  return <Fragment>{output}</Fragment>;
}

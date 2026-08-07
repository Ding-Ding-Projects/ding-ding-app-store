import { useMemo, useState } from 'react';
import { el } from '../el';
import { Icon } from '../icons';

/** The one guided regex builder. Every search surface in the app renders this exact component. */
export function RegexBuilder({ query, onApply, onClose }: { query: string; onApply: (pattern: string, flags: string) => void; onClose: () => void }) {
  const [pattern, setPattern] = useState(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const [flags, setFlags] = useState('iu');
  const [sample, setSample] = useState('Material BlueMap\nDesktop Material\nWimForge');
  const result = useMemo(() => {
    try {
      const expression = new RegExp(pattern.slice(0, 160), flags.replace('g', '') + 'g');
      const matches = Array.from(sample.slice(0, 10_000).matchAll(expression)).slice(0, 100);
      return { error: '', matches: matches.map((match) => ({ text: match[0], groups: match.slice(1) })) };
    } catch (error) {
      return { error: (error as Error).message, matches: [] };
    }
  }, [pattern, flags, sample]);
  const add = (value: string) => setPattern((current) => `${current}${value}`.slice(0, 160));

  return (
    <section className="popover regex-builder" role="dialog" aria-label="Regex builder" {...el('regex-builder')}>
      <header><strong>Regex builder · Regex 建造器</strong><button className="icon-button" onClick={onClose} aria-label="Close regex builder"><Icon>close</Icon></button></header>
      <div className="chip-row" aria-label="Guided regex parts">
        <button onClick={() => add('literal')}>Literal</button><button onClick={() => add('[A-Za-z]')}>Class</button>
        <button onClick={() => add('^')}>Anchor</button><button onClick={() => add('(group)')}>Group</button>
        <button onClick={() => add('|')}>Alternation</button><button onClick={() => add('{1,3}')}>Quantifier</button>
      </div>
      <label>Pattern<input value={pattern} maxLength={160} onChange={(event) => setPattern(event.target.value)} /></label>
      <fieldset><legend>Flags</legend>{['i', 'm', 's', 'u'].map((flag) => <label className="flag" key={flag}><input type="checkbox" checked={flags.includes(flag)} onChange={(event) => setFlags((current) => event.target.checked ? `${current}${flag}` : current.replace(flag, ''))} />{flag}</label>)}</fieldset>
      <label>Sample text<textarea value={sample} maxLength={10_000} onChange={(event) => setSample(event.target.value)} /></label>
      {result.error ? <p className="field-error" role="alert">{result.error}</p> : <p className="match-result">{result.matches.length} matches · {result.matches.map((match) => match.text || 'zero-width').join(', ') || 'No match'}</p>}
      <footer><button className="text-button" onClick={() => navigator.clipboard.writeText(`/${pattern}/${flags}`)}>Copy</button><button className="filled-button" disabled={Boolean(result.error) || !pattern} onClick={() => onApply(pattern, flags)}>Apply to search</button></footer>
    </section>
  );
}

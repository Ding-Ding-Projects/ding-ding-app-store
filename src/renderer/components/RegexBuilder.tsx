import { useEffect, useRef, useState } from 'react';
import { el } from '../el';
import { Icon } from '../icons';
import { regexSafetyIssue } from '../search';

/** The one guided regex builder. Every search surface in the app renders this exact component. */
export function RegexBuilder({ query, onApply, onClose }: { query: string; onApply: (pattern: string, flags: string) => void; onClose: () => void }) {
  const [pattern, setPattern] = useState(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const [flags, setFlags] = useState('iu');
  const [sample, setSample] = useState('Material BlueMap\nDesktop Material\nWimForge');
  const [result, setResult] = useState<{ error: string; matches: Array<{ text: string; groups: string[] }>; pending: boolean }>({ error: '', matches: [], pending: true });
  const evaluationId = useRef(0);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [onClose]);
  useEffect(() => {
    const id = ++evaluationId.current;
    const safetyIssue = regexSafetyIssue(pattern);
    if (safetyIssue) {
      setResult({ error: safetyIssue, matches: [], pending: false });
      return;
    }
    const worker = new Worker(new URL('../regex-worker.ts', import.meta.url), { type: 'module' });
    setResult((current) => ({ ...current, pending: true, error: '' }));
    const timeout = window.setTimeout(() => {
      worker.terminate();
      if (evaluationId.current === id) setResult({ error: 'Evaluation timed out after 150 ms. Adjust the pattern to avoid excessive backtracking.', matches: [], pending: false });
    }, 150);
    worker.addEventListener('message', (event: MessageEvent<{ id: number; error: string; matches: Array<{ text: string; groups: string[] }> }>) => {
      if (event.data.id !== id || evaluationId.current !== id) return;
      window.clearTimeout(timeout);
      worker.terminate();
      setResult({ error: event.data.error, matches: event.data.matches, pending: false });
    }, { once: true });
    worker.postMessage({ id, pattern: pattern.slice(0, 160), flags, sample: sample.slice(0, 10_000) });
    return () => { window.clearTimeout(timeout); worker.terminate(); };
  }, [pattern, flags, sample]);
  const add = (value: string) => setPattern((current) => `${current}${value}`.slice(0, 160));

  return (
    <section className="popover regex-builder" role="dialog" aria-label="Regex builder" {...el('regex-builder')}>
      <header><strong>Regex builder · Regex 建造器</strong><button className="icon-button" onClick={onClose} aria-label="Close regex builder"><Icon>close</Icon></button></header>
      <div className="chip-row" aria-label="Guided regex parts">
        <button {...el('chip')} onClick={() => add('literal')}>Literal</button><button {...el('chip')} onClick={() => add('[A-Za-z]')}>Class</button>
        <button {...el('chip')} onClick={() => add('^')}>Anchor</button><button {...el('chip')} onClick={() => add('(group)')}>Group</button>
        <button {...el('chip')} onClick={() => add('|')}>Alternation</button><button {...el('chip')} onClick={() => add('{1,3}')}>Quantifier</button>
      </div>
      <label>Pattern<input autoFocus value={pattern} maxLength={160} onChange={(event) => setPattern(event.target.value)} /></label>
      <fieldset><legend>Flags</legend>{['i', 'm', 's', 'u'].map((flag) => <label className="flag" key={flag}><input type="checkbox" checked={flags.includes(flag)} onChange={(event) => setFlags((current) => event.target.checked ? `${current}${flag}` : current.replace(flag, ''))} />{flag}</label>)}</fieldset>
      <label>Sample text<textarea value={sample} maxLength={10_000} onChange={(event) => setSample(event.target.value)} /></label>
      {result.pending ? <p className="match-result" role="status">Evaluating safely…</p> : result.error ? <p className="field-error" role="alert">{result.error}</p> : <p className="match-result">{result.matches.length} matches · {result.matches.map((match) => match.text || 'zero-width').join(', ') || 'No match'}</p>}
      <footer><button className="text-button" onClick={() => navigator.clipboard.writeText(`/${pattern}/${flags}`)}>Copy</button><button className="filled-button" disabled={result.pending || Boolean(result.error) || !pattern} onClick={() => onApply(pattern, flags)}>Apply to search</button></footer>
    </section>
  );
}

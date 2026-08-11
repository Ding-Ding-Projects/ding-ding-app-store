import { useEffect, useRef, useState } from 'react';
import { el } from '../el';
import { Icon } from '../icons';
import { regexSafetyIssue } from '../search';
import { evaluateRegexInWorker } from '../regex-evaluator';
import type { UserSettings } from '../../shared/contracts';
import { dialogCopy } from '../dialog-emoji';

/** The one guided regex builder. Every search surface in the app renders this exact component. */
export function RegexBuilder({ query, settings, onApply, onClose, initialPattern, initialFlags }: { query: string; settings: UserSettings; onApply: (pattern: string, flags: string) => void; onClose: () => void; initialPattern?: string; initialFlags?: string }) {
  const [pattern, setPattern] = useState(initialPattern ?? query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const [flags, setFlags] = useState(initialFlags ?? 'iu');
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
    const controller = new AbortController();
    setResult((current) => ({ ...current, pending: true, error: '' }));
    void evaluateRegexInWorker({ pattern, flags, sample }, controller.signal).then((evaluation) => {
      if (evaluationId.current !== id) return;
      setResult({ error: evaluation.error, matches: evaluation.matches, pending: false });
    });
    return () => controller.abort();
  }, [pattern, flags, sample]);
  const add = (value: string) => setPattern((current) => `${current}${value}`.slice(0, 160));

  return (
    <section className="popover regex-builder" role="dialog" aria-label="Regex builder" {...el('regex-builder')}>
      <header><strong>{dialogCopy(settings, 'Regex builder · Regex 建造器', '🔎')}</strong><button className="icon-button" onClick={onClose} aria-label="Close regex builder"><Icon>close</Icon></button></header>
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

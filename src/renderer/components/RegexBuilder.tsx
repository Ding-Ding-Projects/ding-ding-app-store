import { useEffect, useRef, useState } from 'react';
import { el } from '../el';
import { Icon } from '../icons';
import { regexSafetyIssue } from '../search';
import { evaluateRegexInWorker } from '../regex-evaluator';
import type { UserSettings } from '../../shared/contracts';
import { dialogCopy } from '../dialog-emoji';
import { label } from '../i18n';

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
  const matchText = result.matches.map((match) => match.text || label(settings, 'zero-width', '零寬')).join(', ');

  return (
    <section className="popover regex-builder" role="dialog" aria-label={label(settings, 'Regex builder', 'Regex 建造器')} {...el('regex-builder')}>
      <header><strong>{dialogCopy(settings, label(settings, 'Regex builder', 'Regex 建造器'), '🔎')}</strong><button type="button" className="icon-button" onClick={onClose} aria-label={label(settings, 'Close regex builder', '關閉 Regex 建造器')}><Icon>close</Icon></button></header>
      <div className="chip-row" aria-label={label(settings, 'Guided regex parts', '引導式 Regex 元件')}>
        <button type="button" {...el('chip')} onClick={() => add('literal')}>{label(settings, 'Literal', '字面值')}</button><button type="button" {...el('chip')} onClick={() => add('[A-Za-z]')}>{label(settings, 'Class', '字元類別')}</button>
        <button type="button" {...el('chip')} onClick={() => add('^')}>{label(settings, 'Anchor', '錨點')}</button><button type="button" {...el('chip')} onClick={() => add('(group)')}>{label(settings, 'Group', '群組')}</button>
        <button type="button" {...el('chip')} onClick={() => add('|')}>{label(settings, 'Alternation', '交替')}</button><button type="button" {...el('chip')} onClick={() => add('{1,3}')}>{label(settings, 'Quantifier', '量詞')}</button>
      </div>
      <label>{label(settings, 'Pattern', 'Pattern')}<input autoFocus value={pattern} maxLength={160} onChange={(event) => setPattern(event.target.value)} /></label>
      <fieldset><legend>{label(settings, 'Flags', 'Flags')}</legend>{['i', 'm', 's', 'u'].map((flag) => <label className="flag" key={flag}><input type="checkbox" checked={flags.includes(flag)} onChange={(event) => setFlags((current) => event.target.checked ? `${current}${flag}` : current.replace(flag, ''))} />{flag}</label>)}</fieldset>
      <label>{label(settings, 'Sample text', '範例文字')}<textarea value={sample} maxLength={10_000} onChange={(event) => setSample(event.target.value)} /></label>
      {result.pending ? <p className="match-result" role="status">{label(settings, 'Evaluating safely…', '安全評估緊…')}</p> : result.error ? <p className="field-error" role="alert">{result.error}</p> : <p className="match-result">{label(settings, `${result.matches.length} match${result.matches.length === 1 ? '' : 'es'} · ${matchText || 'No match'}`, `${result.matches.length} 個符合 · ${matchText || '冇符合'}`)}</p>}
      <footer><button type="button" className="text-button" onClick={() => navigator.clipboard.writeText(`/${pattern}/${flags}`)}>{label(settings, 'Copy', '複製')}</button><button type="button" className="filled-button" disabled={result.pending || Boolean(result.error) || !pattern} onClick={() => onApply(pattern, flags)}>{label(settings, 'Apply to search', '套用到搜尋')}</button></footer>
    </section>
  );
}

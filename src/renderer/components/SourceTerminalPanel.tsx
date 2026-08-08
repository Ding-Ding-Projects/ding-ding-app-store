import { useEffect, useMemo, useRef } from 'react';
import type { SourceJobState, SourceTerminalEvent, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';

const ACTIVE_STATES = new Set<SourceJobState>(['queued', 'preparing', 'running', 'repairing', 'cancelling']);

export function SourceTerminalPanel({ appName, events, fallbackMessage, settings, onCancel, onClose }: {
  appName: string;
  events: readonly Readonly<SourceTerminalEvent>[];
  fallbackMessage?: string;
  settings: UserSettings;
  onCancel(): void;
  onClose(): void;
}) {
  const output = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const followOutput = useRef(true);
  const state = events.at(-1)?.state ?? (fallbackMessage ? 'failed' : 'queued');
  const active = ACTIVE_STATES.has(state);
  const progress = [...events].reverse().find((event) => event.progress !== null)?.progress ?? 0;
  const lastEvent = events.at(-1);
  const status = useMemo(() => ({
    queued: label(settings, 'Queued', '排緊隊'),
    preparing: label(settings, 'Preparing isolated workspace', '準備隔離工作區'),
    running: label(settings, 'Running reviewed steps', '執行已審核步驟'),
    repairing: label(settings, 'Repairing the exact failure', '修正指定失敗'),
    cancelling: label(settings, 'Cancelling and cleaning up', '取消同清理緊'),
    succeeded: label(settings, 'Succeeded', '成功'),
    failed: label(settings, 'Failed', '失敗'),
    cancelled: label(settings, 'Cancelled', '已取消'),
  } satisfies Record<SourceJobState, string>)[state], [settings, state]);

  useEffect(() => {
    const element = output.current;
    if (element && followOutput.current) element.scrollTop = element.scrollHeight;
  }, [events]);

  useEffect(() => { panel.current?.focus(); }, []);
  const liveProgress = Math.floor(progress / 10) * 10;
  const liveSummary = active ? `${status}. ${liveProgress}%` : `${status}${lastEvent?.text ? `: ${lastEvent.text}` : ''}`;

  return (
    <aside ref={panel} className="source-terminal-panel" role="region" tabIndex={-1} aria-busy={active} aria-labelledby="source-terminal-title" {...el('dialog')}>
      <header>
        <div>
          <p className="eyebrow">{label(settings, 'Disposable source runner', '即棄 source 執行器')}</p>
          <h2 id="source-terminal-title"><Icon>terminal</Icon>{appName}</h2>
        </div>
        {!active && <button className="icon-button" onClick={onClose} aria-label={label(settings, 'Close terminal', '關閉終端')}><Icon>close</Icon></button>}
      </header>
      <p className="supporting">{label(settings, 'Read-only structured output. There is no interactive shell prompt, and commands, paths, URLs, environment values, and credentials never come from this window.', '只讀結構化輸出。呢度冇互動 shell；指令、路徑、網址、環境值同憑證都唔會由呢個視窗提供。')}</p>
      <div className="terminal-status">
        <span className={`status-pill terminal-state-${state}`}>{status}</span>
        <progress max={100} value={progress} aria-label={label(settings, 'Source job progress', 'Source 工作進度')} />
        <span>{progress}%</span>
      </div>
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{liveSummary}</div>
      <div ref={output} onScroll={(event) => { const element = event.currentTarget; followOutput.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24; }} className="terminal-output" role="log" aria-live="off" tabIndex={0} aria-label={label(settings, 'Source build and repair output', 'Source 建置同修正輸出')}>
        {events.length === 0 && fallbackMessage && <div className="terminal-line terminal-stderr"><span aria-hidden="true">0001</span><span aria-hidden="true">system</span><span>{fallbackMessage}</span></div>}
        {events.map((event) => (
          <div key={`${event.jobId}-${event.sequence}`} className={`terminal-line terminal-${event.stream}`}>
            <span className="terminal-sequence" aria-hidden="true">{String(event.sequence + 1).padStart(4, '0')}</span>
            <span className="terminal-stream" aria-hidden="true">{event.stream}</span>
            <span>{event.text}</span>
          </div>
        ))}
      </div>
      <footer>
        {active
          ? <button className="text-button danger" disabled={state === 'cancelling'} onClick={onCancel}><Icon>cancel</Icon>{state === 'cancelling' ? label(settings, 'Cancelling…', '取消緊…') : label(settings, 'Cancel source job', '取消 source 工作')}</button>
          : <button className="filled-button" onClick={onClose}><Icon>done</Icon>{label(settings, 'Close', '關閉')}</button>}
      </footer>
    </aside>
  );
}

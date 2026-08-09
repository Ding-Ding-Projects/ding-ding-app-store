import type { SourceIsolationStatus, UserSettings } from '../../shared/contracts';
import { Icon } from '../icons';
import { formatAbsolute, label } from '../i18n';

export function SourceIsolationStatusCard({ settings, status, loading, onRefresh, compact = false }: {
  settings: UserSettings;
  status: SourceIsolationStatus | null;
  loading: boolean;
  onRefresh(): void;
  compact?: boolean;
}) {
  const available = status?.available === true;
  const title = label(settings, 'Source execution isolation', 'Source 執行隔離');
  const state = status
    ? available
      ? label(settings, 'Guest transport available', 'Guest transport 可用')
      : label(settings, 'Guest transport unavailable', 'Guest transport 未可用')
    : label(settings, 'Isolation status not checked', '未檢查隔離狀態');

  return (
    <section className={`source-isolation-card${compact ? ' compact' : ''}`} aria-labelledby="source-isolation-title">
      <header className="source-isolation-header">
        <div>
          <p className="eyebrow">{label(settings, 'Automatic source repair', '自動 source 修正')}</p>
          <h2 id="source-isolation-title"><Icon>info</Icon>{title}</h2>
        </div>
        <button className="text-button" disabled={loading} onClick={onRefresh} aria-describedby="source-isolation-remediation">
          <Icon>refresh</Icon>{loading ? label(settings, 'Checking…', '檢查緊…') : label(settings, 'Check again', '再檢查')}
        </button>
      </header>
      <p className={`source-isolation-state ${available ? 'available' : 'unavailable'}`} role="status">
        <Icon>{available ? 'check_circle' : 'block'}</Icon>{state}
      </p>
      {!status && <p className="supporting">{label(settings, 'The app has not queried the disposable guest yet.', '程式仲未查詢即棄 guest。')}</p>}
      {status && (
        <>
          <dl className="source-isolation-details">
            <div><dt>{label(settings, 'Provider', '提供者')}</dt><dd>{status.provider}</dd></div>
            <div><dt>{label(settings, 'Reason', '原因')}</dt><dd><code>{status.reason}</code></dd></div>
            <div><dt>{label(settings, 'Checked', '檢查時間')}</dt><dd>{formatAbsolute(status.checkedAt)}</dd></div>
          </dl>
          <div className="source-isolation-evidence">
            <strong>{label(settings, 'Evidence', '證據')}</strong>
            <ul>{status.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <p id="source-isolation-remediation" className="supporting">{status.remediation}</p>
        </>
      )}
      <p className="supporting">{label(settings, 'No source code, command, path, credential, or OpenCode process starts until this boundary is attested.', '未驗證呢個邊界之前，唔會開始 source code、指令、路徑、憑證或者 OpenCode 程序。')}</p>
    </section>
  );
}

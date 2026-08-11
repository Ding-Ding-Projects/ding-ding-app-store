import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { AuthenticatorAlgorithm, AuthenticatorDigits, UserSettings } from '../../shared/contracts';
import { SearchBox } from '../components/SearchBox';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import type { Notify } from '../notify';
import { makeMatcher, useSurfaceSearch } from '../search';
import type { AuthenticatorApi } from '../state/use-authenticator';

const ALGORITHMS: readonly { value: AuthenticatorAlgorithm; en: string; yue: string }[] = [
  { value: 'sha1', en: 'SHA-1', yue: 'SHA-1' },
  { value: 'sha256', en: 'SHA-256', yue: 'SHA-256' },
  { value: 'sha512', en: 'SHA-512', yue: 'SHA-512' },
];
const DIGITS: readonly AuthenticatorDigits[] = [6, 7, 8];

export function AuthenticatorPage({ settings, authenticator, notify, openRegex, onRegexHandled }: {
  settings: UserSettings;
  authenticator: AuthenticatorApi;
  notify: Notify;
  openRegex: boolean;
  onRegexHandled(): void;
}) {
  const search = useSurfaceSearch('authenticator');
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const [secret, setSecret] = useState('');
  const [algorithm, setAlgorithm] = useState<AuthenticatorAlgorithm>('sha1');
  const [digits, setDigits] = useState<AuthenticatorDigits>(6);
  const [periodSeconds, setPeriodSeconds] = useState(30);
  const [result, setResult] = useState<Awaited<ReturnType<AuthenticatorApi['preview']>> | null>(null);
  const viewSettings = settings;
  const visible = matcher('Authenticator one-shot preview RFC 6238 TOTP secret algorithm digits period credential vault storage QR registration export');

  const calculate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = await authenticator.preview({ secret, algorithm, digits, periodSeconds });
    setSecret('');
    setResult(next);
    notify({ ok: next.ok, message: label(viewSettings, next.message, next.messageYue) });
  };

  return (
    <>
      <SearchBox
        surface="authenticator"
        settings={viewSettings}
        placeholder={label(viewSettings, 'Search authenticator controls and status', '搵驗證器控制同狀態')}
        openBuilder={openRegex}
        onBuilderHandled={onRegexHandled}
      />
      {!visible && (
        <div className="empty-state" {...el('empty-state')}><Icon>search_off</Icon><h2>{label(viewSettings, 'No matching authenticator control', '冇配到嘅驗證器控制')}</h2><p>{label(viewSettings, 'Clear the search to see the local preview and storage boundary.', '清除搜尋就會見到本機預覽同儲存邊界。')}</p></div>
      )}
      {visible && <section className="settings-grid" aria-label={label(viewSettings, 'Authenticator', '驗證器')}>
        <section className="settings-card" {...el('settings-card')}>
          <h2>{label(viewSettings, 'Authenticator storage', '驗證器儲存')}</h2>
          <p className="supporting" role="status">
            {authenticator.loading
              ? label(viewSettings, 'Checking the credential-vault boundary…', '檢查緊憑證庫邊界…')
              : authenticator.status ? label(viewSettings, authenticator.status.message, authenticator.status.messageYue) : label(viewSettings, 'Authenticator storage status is unavailable.', '驗證器儲存狀態暫時用唔到。')}
          </p>
          <p>{label(viewSettings, 'This bounded slice offers a one-shot RFC 6238 preview. It does not register, persist, export, scan, or reveal a QR secret; the typed secret is cleared after the calculation.', '呢個有限功能只提供一次性 RFC 6238 預覽，唔會註冊、儲存、匯出、掃描或者顯示 QR 秘密；計算完會清走輸入秘密。')}</p>
          <p className="supporting">{label(viewSettings, 'No saved entries are available while the operating-system credential-vault adapter is unavailable.', '作業系統憑證庫配接器未接駁之前，冇已儲存項目可以用。')}</p>
        </section>
        <section className="settings-card" {...el('settings-card')}>
          <h2>{label(viewSettings, 'One-shot TOTP preview', '一次性 TOTP 預覽')}</h2>
          <form onSubmit={(event) => void calculate(event)}>
            <label htmlFor="authenticator-secret">{label(viewSettings, 'Base32 secret (cleared after preview)', 'Base32 秘密（預覽後清走）')}<input id="authenticator-secret" type="password" autoComplete="off" maxLength={256} value={secret} onChange={(event) => setSecret(event.target.value)} required /></label>
            <label htmlFor="authenticator-algorithm">{label(viewSettings, 'Algorithm', '演算法')}<select id="authenticator-algorithm" value={algorithm} onChange={(event) => setAlgorithm(event.target.value as AuthenticatorAlgorithm)}>{ALGORITHMS.map((item) => <option key={item.value} value={item.value}>{label(viewSettings, item.en, item.yue)}</option>)}</select></label>
            <label htmlFor="authenticator-digits">{label(viewSettings, 'Digits', '位數')}<select id="authenticator-digits" value={digits} onChange={(event) => setDigits(Number(event.target.value) as AuthenticatorDigits)}>{DIGITS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label htmlFor="authenticator-period">{label(viewSettings, 'Period in seconds', '週期秒數')}<input id="authenticator-period" type="number" min={1} max={3600} step={1} value={periodSeconds} onChange={(event) => setPeriodSeconds(Number(event.target.value))} /></label>
            <button className="filled-button" type="submit" disabled={!secret.trim() || periodSeconds < 1 || periodSeconds > 3600}>{label(viewSettings, 'Calculate current code', '計算目前驗證碼')}</button>
          </form>
          {result && <div className="notice" role={result.ok ? 'status' : 'alert'}>
            <Icon>{result.ok ? 'check_circle' : 'error'}</Icon>
            <div>
              <strong>{result.ok ? label(viewSettings, `Current code: ${result.code}`, `目前驗證碼：${result.code}`) : label(viewSettings, result.message, result.messageYue)}</strong>
              {result.ok && <p className="supporting">{label(viewSettings, `${result.remainingSeconds} seconds until rollover · ${result.algorithm?.toUpperCase()} · ${result.digits} digits · ${result.periodSeconds}s · memory only`, `${result.remainingSeconds} 秒後換碼 · ${result.algorithm?.toUpperCase()} · ${result.digits} 位 · ${result.periodSeconds} 秒 · 只留喺記憶體`)}</p>}
            </div>
          </div>}
        </section>
      </section>}
    </>
  );
}

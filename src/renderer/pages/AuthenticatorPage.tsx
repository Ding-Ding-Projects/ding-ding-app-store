import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { FormEvent } from 'react';
import type { AuthenticatorAlgorithm, AuthenticatorDigits, AuthenticatorRegistrationPreviewResult, UserSettings } from '../../shared/contracts';
import { SearchBox } from '../components/SearchBox';
import { RegexBuilder } from '../components/RegexBuilder';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import type { Notify } from '../notify';
import { makeMatcher, useSurfaceSearch } from '../search';
import type { SearchState } from '../search';
import type { AuthenticatorApi } from '../state/use-authenticator';

const ALGORITHMS: readonly { value: AuthenticatorAlgorithm; en: string; yue: string }[] = [
  { value: 'sha1', en: 'SHA-1', yue: 'SHA-1' },
  { value: 'sha256', en: 'SHA-256', yue: 'SHA-256' },
  { value: 'sha512', en: 'SHA-512', yue: 'SHA-512' },
];
const DIGITS: readonly AuthenticatorDigits[] = [6, 7, 8];

type PickerValue = string | number;
type PickerOption = { value: PickerValue; label: string };

/**
 * A bounded, keyboard-first picker. Each instance owns its query and regex
 * state so source, algorithm, and digits never leak filters into one another.
 */
function AuthenticatorPicker({ id, labelText, settings, value, options, disabled, onChange }: {
  id: string;
  labelText: string;
  settings: UserSettings;
  value: PickerValue;
  options: readonly PickerOption[];
  disabled: boolean;
  onChange(value: PickerValue): void;
}) {
  const [open, setOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [regex, setRegex] = useState<SearchState['regex']>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const matcher = useMemo(() => makeMatcher({ query, regex }), [query, regex]);
  const visibleOptions = useMemo(() => options.filter((option) => matcher(option.label)), [matcher, options]);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    setActiveIndex(Math.max(0, visibleOptions.findIndex((option) => option.value === value)));
    window.setTimeout(() => inputRef.current?.focus(), 0);
    // Query/regex changes intentionally refocus the field so keyboard users can
    // continue filtering after an option list update; parent rerenders alone do
    // not steal focus.
  }, [open, value, query, regex]);

  const close = () => {
    setOpen(false);
    setBuilderOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  const choose = (option: PickerOption) => {
    onChange(option.value);
    close();
  };
  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  };
  const onListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (!visibleOptions.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); setActiveIndex((index) => (index + 1) % visibleOptions.length); return; }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); setActiveIndex((index) => (index - 1 + visibleOptions.length) % visibleOptions.length); return; }
    if (event.key === 'Home') { event.preventDefault(); setActiveIndex(0); return; }
    if (event.key === 'End') { event.preventDefault(); setActiveIndex(visibleOptions.length - 1); return; }
    if (event.key === 'Enter') { event.preventDefault(); choose(visibleOptions[activeIndex] ?? visibleOptions[0]); }
  };

  return <div className="authenticator-picker setting-field">
    <span id={`${id}-label`}>{labelText}</span>
    <button
      ref={triggerRef}
      id={id}
      type="button"
      className="authenticator-picker-trigger"
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-labelledby={`${id}-label`}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={onTriggerKeyDown}
    >
      <span>{selected?.label ?? ''}</span><Icon>expand_more</Icon>
    </button>
    {open && <section className="popover authenticator-picker-popover" role="dialog" aria-label={label(settings, `${labelText} picker`, `${labelText}選擇器`)} onKeyDown={onListKeyDown}>
      <div className="authenticator-picker-search">
        <Icon>search</Icon>
        <input
          ref={inputRef}
          type="search"
          value={query}
          maxLength={160}
          placeholder={label(settings, `Search ${labelText.toLocaleLowerCase()}`, `搜尋${labelText}`)}
          aria-label={label(settings, `Search ${labelText.toLocaleLowerCase()}`, `搜尋${labelText}`)}
          aria-controls={`${id}-options`}
          aria-activedescendant={visibleOptions[activeIndex] ? `${id}-option-${String(visibleOptions[activeIndex].value)}` : undefined}
          onChange={(event) => { setQuery(event.target.value); if (regex) setRegex({ ...regex, pattern: event.target.value }); }}
        />
        <button className="icon-button" type="button" aria-label={label(settings, `Open regex builder for ${labelText}`, `開啟${labelText}正則建造器`)} aria-expanded={builderOpen} onClick={() => setBuilderOpen((current) => !current)}><Icon>regular_expression</Icon></button>
        {builderOpen && <RegexBuilder query={query} settings={settings} onClose={() => { setBuilderOpen(false); window.setTimeout(() => inputRef.current?.focus(), 0); }} onApply={(pattern, flags) => { setQuery(pattern); setRegex({ pattern, flags }); setBuilderOpen(false); window.setTimeout(() => inputRef.current?.focus(), 0); }} />}
      </div>
      <div id={`${id}-options`} className="authenticator-picker-list" role="listbox" aria-label={labelText}>
        {visibleOptions.length === 0 ? <p className="empty-state compact" role="status">{label(settings, 'No matching options.', '冇配到嘅選項。')}</p> : visibleOptions.map((option, index) => <button
          type="button"
          role="option"
          id={`${id}-option-${String(option.value)}`}
          aria-selected={option.value === value}
          className={index === activeIndex ? 'authenticator-picker-option active' : 'authenticator-picker-option'}
          key={String(option.value)}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(option)}
        >{option.label}</button>)}
      </div>
    </section>}
  </div>;
}

function remaining(entry: AuthenticatorApi['entries'][number]): number | null {
  if (!entry.expiresAt) return entry.remainingSeconds;
  return Math.max(0, Math.ceil((Date.parse(entry.expiresAt) - Date.now()) / 1_000));
}

function groupedSecret(secret: string): string {
  return secret.replace(/\s+/g, '').match(/.{1,4}/g)?.join(' ') ?? '';
}

function QrMatrix({ preview, settings }: { preview: AuthenticatorRegistrationPreviewResult; settings: UserSettings }) {
  if (!preview.qr || !preview.metadata) return null;
  return <div className="authenticator-qr-wrap">
    <div className="authenticator-qr" role="img" aria-label={label(settings, `Authenticator QR code for ${preview.metadata.label}`, `為 ${preview.metadata.label} 配對嘅 authenticator QR code`)} style={{ gridTemplateColumns: `repeat(${preview.qr.size}, 1fr)` }}>
      {preview.qr.modules.flatMap((row, rowIndex) => [...row].map((module, columnIndex) => <span aria-hidden="true" key={`${rowIndex}-${columnIndex}`} className={module === '1' ? 'authenticator-qr-module on' : 'authenticator-qr-module'} />))}
    </div>
    <p className="supporting">{label(settings, 'Scan this local QR representation with your authenticator, then confirm one current code below.', '用 authenticator 掃描呢個本機 QR 表示，然後喺下面確認一個目前驗證碼。')}</p>
  </div>;
}

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
  const [uri, setUri] = useState('');
  const [issuer, setIssuer] = useState('');
  const [account, setAccount] = useState('');
  const [source, setSource] = useState<'manual' | 'otpauth-uri'>('manual');
  const [algorithm, setAlgorithm] = useState<AuthenticatorAlgorithm>('sha1');
  const [digits, setDigits] = useState<AuthenticatorDigits>(6);
  const [periodSeconds, setPeriodSeconds] = useState(30);
  const [showSecret, setShowSecret] = useState(false);
  const [preview, setPreview] = useState<AuthenticatorRegistrationPreviewResult | null>(null);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [confirmingRegistrationId, setConfirmingRegistrationId] = useState<string | null>(null);
  const [clock, setClock] = useState(0);
  const viewSettings = settings;
  const visible = matcher('Authenticator registration otpauth URI Base32 secret issuer account algorithm digits period credential vault QR pairing current code countdown saved entries local search');
  const visibleEntries = useMemo(() => authenticator.entries.filter((entry) => matcher(`${entry.label} ${entry.issuer} ${entry.account} ${entry.algorithm} ${entry.digits} ${entry.periodSeconds}`)), [authenticator.entries, matcher, clock]);

  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      if (!document.hidden) setClock((value) => value + 1);
      timer = window.setTimeout(schedule, document.hidden ? 5_000 : 1_000);
    };
    timer = window.setTimeout(schedule, 1_000);
    return () => { if (timer !== undefined) window.clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (!authenticator.entries.length) return undefined;
    let timer: number | undefined;
    let disposed = false;
    const refreshIfVisible = () => { if (!disposed && !document.hidden) void authenticator.refresh(); };
    const schedule = () => {
      refreshIfVisible();
      if (!disposed) timer = window.setTimeout(schedule, document.hidden ? 15_000 : 5_000);
    };
    const onVisibilityChange = () => { if (!document.hidden) refreshIfVisible(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    timer = window.setTimeout(schedule, 5_000);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [authenticator.entries.length, authenticator.refresh]);

  const submitRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request = source === 'otpauth-uri'
      ? { source, uri }
      : { source, secret, issuer, account, algorithm, digits, periodSeconds };
    const next = await authenticator.prepare(request);
    setPreview(next);
    setConfirmationCode('');
    setShowSecret(false);
    notify({ ok: next.ok, message: label(viewSettings, next.message, next.messageYue) });
  };

  const confirmRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const registrationId = preview?.registrationId;
    if (!registrationId || confirmingRegistrationId === registrationId) return;
    setConfirmingRegistrationId(registrationId);
    try {
      const next = await authenticator.confirm({ registrationId, code: confirmationCode });
      notify({ ok: next.ok, message: label(viewSettings, next.message, next.messageYue) });
      if (next.ok) {
        setPreview(null);
        setSecret('');
        setUri('');
        setIssuer('');
        setAccount('');
        setConfirmationCode('');
        setShowSecret(false);
      }
    } finally {
      setConfirmingRegistrationId(null);
    }
  };

  const discardPairing = async () => {
    if (!preview?.registrationId) return;
    try {
      await authenticator.cancel(preview.registrationId);
      setPreview(null);
      setConfirmationCode('');
      setSecret('');
      setUri('');
      setShowSecret(false);
      notify({ ok: true, message: label(viewSettings, 'Pairing preview discarded; its in-memory secret was cleared.', '配對預覽已丟棄；記憶體入面嘅秘密已清走。') });
    } catch {
      notify({ ok: false, message: label(viewSettings, 'The pairing preview could not be discarded; it remains active.', '未能丟棄配對預覽；佢仍然有效。') });
    }
  };

  const copyManualSecret = async () => {
    const grouped = groupedSecret(secret);
    if (!grouped || !showSecret) return;
    try {
      await navigator.clipboard.writeText(grouped);
      notify({ ok: true, message: label(viewSettings, 'The revealed Base32 secret was copied locally.', '已喺本機複製顯示緊嘅 Base32 秘密。') });
    } catch {
      notify({ ok: false, message: label(viewSettings, 'The Base32 secret could not be copied by the local clipboard.', '本機剪貼簿未能複製 Base32 秘密。') });
    }
  };

  const copyRegistrationUri = async () => {
    if (!uri || !showSecret) return;
    try {
      await navigator.clipboard.writeText(uri);
      notify({ ok: true, message: label(viewSettings, 'The revealed otpauth URI was copied locally.', '已喺本機複製顯示緊嘅 otpauth URI。') });
    } catch {
      notify({ ok: false, message: label(viewSettings, 'The otpauth URI could not be copied by the local clipboard.', '本機剪貼簿未能複製 otpauth URI。') });
    }
  };

  return <>
    <SearchBox
      surface="authenticator"
      settings={viewSettings}
      placeholder={label(viewSettings, 'Search authenticator controls and entries', '搵驗證器控制同項目')}
      openBuilder={openRegex}
      onBuilderHandled={onRegexHandled}
    />
    {!visible && <div className="empty-state" {...el('empty-state')}><Icon>search_off</Icon><h2>{label(viewSettings, 'No matching authenticator control or entry', '冇配到嘅驗證器控制或者項目')}</h2><p>{label(viewSettings, 'Clear the search to see registration and local entries.', '清除搜尋就會見到註冊同本機項目。')}</p></div>}
    {visible && <section className="settings-grid" aria-label={label(viewSettings, 'Authenticator', '驗證器')}>
      <section className="settings-card" {...el('settings-card')}>
        <h2>{label(viewSettings, 'Authenticator storage', '驗證器儲存')}</h2>
        <p className="supporting" role="status">
          {authenticator.loading
            ? label(viewSettings, 'Checking the credential-vault boundary…', '檢查緊憑證庫邊界…')
            : authenticator.status ? label(viewSettings, authenticator.status.message, authenticator.status.messageYue) : label(viewSettings, 'Authenticator storage status is unavailable.', '驗證器儲存狀態暫時用唔到。')}
        </p>
        <p>{label(viewSettings, 'Secrets are accepted once for pairing, encrypted by the operating-system credential vault, and never returned in list metadata. QR generation is local and has no network path.', '秘密只喺配對時接收一次，由作業系統憑證庫加密；項目清單 metadata 唔會返回秘密。QR 喺本機產生，冇網絡路徑。')}</p>
        <p className="supporting">{label(viewSettings, 'This bounded slice does not claim QR image import, camera scanning, rename, reorder, groups, bulk actions, next-code peek, or deliberate secret export.', '呢個有限功能冇聲稱支援 QR 圖片匯入、相機掃描、改名、排序、分組、批量操作、下一碼預覽或者刻意匯出秘密。')}</p>
      </section>
      <section className="settings-card" {...el('settings-card')}>
        <h2>{label(viewSettings, 'Register an authenticator entry', '註冊 authenticator 項目')}</h2>
        {preview?.ok && <p className="supporting">{label(viewSettings, 'Registration fields are locked while this pairing preview is active, so the QR, code, and metadata cannot drift apart.', '配對預覽進行中會鎖住註冊欄位，避免 QR、驗證碼同 metadata 對唔上。')}</p>}
        <form onSubmit={(event) => void submitRegistration(event)}>
          <AuthenticatorPicker
            id="authenticator-source"
            labelText={label(viewSettings, 'Registration source', '註冊來源')}
            settings={viewSettings}
            value={source}
            disabled={Boolean(preview?.ok)}
            options={[{ value: 'manual', label: label(viewSettings, 'Manual Base32 metadata', '手動 Base32 metadata') }, { value: 'otpauth-uri', label: 'otpauth://totp/ URI' }]}
            onChange={(value) => { setSource(value as typeof source); setPreview(null); setSecret(''); setUri(''); setShowSecret(false); }}
          />
          {source === 'otpauth-uri' ? <>
            <label htmlFor="authenticator-uri">{label(viewSettings, 'otpauth://totp/ URI (hidden until reveal)', 'otpauth://totp/ URI（顯示前會收埋）')}<input id="authenticator-uri" disabled={Boolean(preview?.ok)} type={showSecret ? 'text' : 'password'} autoComplete="off" maxLength={2_048} value={uri} onChange={(event) => setUri(event.target.value)} required /></label>
            <div className="button-row">
              <button className="text-button" type="button" disabled={false} onClick={() => setShowSecret((value) => !value)}>{showSecret ? label(viewSettings, 'Hide otpauth URI', '收埋 otpauth URI') : label(viewSettings, 'Reveal otpauth URI', '顯示 otpauth URI')}</button>
              <button className="text-button" type="button" disabled={!showSecret || !uri} onClick={() => void copyRegistrationUri()}>{label(viewSettings, 'Copy otpauth URI', '複製 otpauth URI')}</button>
            </div>
          </> : <>
            <label htmlFor="authenticator-secret">{label(viewSettings, 'Base32 secret (cleared after pairing)', 'Base32 秘密（配對後清走）')}<input id="authenticator-secret" disabled={Boolean(preview?.ok)} type={showSecret ? 'text' : 'password'} autoComplete="off" maxLength={256} value={secret} onChange={(event) => setSecret(event.target.value)} required /></label>
            <button className="text-button" type="button" disabled={Boolean(preview?.ok)} onClick={() => setShowSecret((value) => !value)}>{showSecret ? label(viewSettings, 'Hide manual secret', '收埋手動秘密') : label(viewSettings, 'Reveal manual secret', '顯示手動秘密')}</button>
            <label htmlFor="authenticator-issuer">{label(viewSettings, 'Issuer (optional)', 'Issuer（可選）')}<input id="authenticator-issuer" disabled={Boolean(preview?.ok)} type="text" maxLength={128} value={issuer} onChange={(event) => setIssuer(event.target.value)} /></label>
            <label htmlFor="authenticator-account">{label(viewSettings, 'Account', '帳戶')}<input id="authenticator-account" disabled={Boolean(preview?.ok)} type="text" maxLength={256} value={account} onChange={(event) => setAccount(event.target.value)} required /></label>
            <AuthenticatorPicker
              id="authenticator-algorithm"
              labelText={label(viewSettings, 'Algorithm', '演算法')}
              settings={viewSettings}
              value={algorithm}
              disabled={Boolean(preview?.ok)}
              options={ALGORITHMS.map((item) => ({ value: item.value, label: label(viewSettings, item.en, item.yue) }))}
              onChange={(value) => setAlgorithm(value as AuthenticatorAlgorithm)}
            />
            <AuthenticatorPicker
              id="authenticator-digits"
              labelText={label(viewSettings, 'Digits', '位數')}
              settings={viewSettings}
              value={digits}
              disabled={Boolean(preview?.ok)}
              options={DIGITS.map((value) => ({ value, label: String(value) }))}
              onChange={(value) => setDigits(Number(value) as AuthenticatorDigits)}
            />
            <label htmlFor="authenticator-period">{label(viewSettings, 'Period in seconds', '週期秒數')}<input id="authenticator-period" disabled={Boolean(preview?.ok)} type="number" min={1} max={3600} step={1} value={periodSeconds} onChange={(event) => setPeriodSeconds(Number(event.target.value))} /></label>
          </>}
          <button className="filled-button" type="submit" disabled={authenticator.loading || Boolean(preview?.ok) || (source === 'manual' ? !secret.trim() || !account.trim() : !uri.trim())}>{label(viewSettings, 'Prepare local QR pairing', '準備本機 QR 配對')}</button>
        </form>
        {preview && <div className="notice" role={preview.ok ? 'status' : 'alert'}>
          <Icon>{preview.ok ? 'qr_code_2' : 'error'}</Icon>
          <div>
            <strong>{label(viewSettings, preview.message, preview.messageYue)}</strong>
            {preview.ok && preview.metadata && <>
              <p>{preview.metadata.label} · {preview.metadata.algorithm.toUpperCase()} · {preview.metadata.digits} digits · {preview.metadata.periodSeconds}s</p>
              <QrMatrix preview={preview} settings={viewSettings} />
              {source === 'manual' && <div className="authenticator-manual-secret">
                <p className="supporting">{label(viewSettings, 'Manual secret (explicit reveal required)', '手動秘密（必須明確顯示）')}</p>
                <code aria-label={label(viewSettings, showSecret ? 'Revealed grouped Base32 secret' : 'Base32 secret hidden', showSecret ? '已顯示分組 Base32 秘密' : 'Base32 秘密已收埋')}>{showSecret ? groupedSecret(secret) : '•••• ••••'}</code>
                <div className="button-row">
                  <button className="text-button" type="button" onClick={() => setShowSecret((value) => !value)}>{showSecret ? label(viewSettings, 'Hide manual secret', '收埋手動秘密') : label(viewSettings, 'Reveal manual secret', '顯示手動秘密')}</button>
                  <button className="text-button" type="button" disabled={!showSecret || !secret} onClick={() => void copyManualSecret()}>{label(viewSettings, 'Copy grouped Base32', '複製分組 Base32')}</button>
                </div>
              </div>}
              <form onSubmit={(event) => void confirmRegistration(event)}>
                <label htmlFor="authenticator-confirm-code">{label(viewSettings, 'Current code from your authenticator', '你個 authenticator 嘅目前驗證碼')}<input id="authenticator-confirm-code" inputMode="numeric" pattern="[0-9]{6,8}" maxLength={8} value={confirmationCode} onChange={(event) => setConfirmationCode(event.target.value.replace(/\D/g, ''))} required /></label>
                <button className="filled-button" type="submit" disabled={!confirmationCode || confirmingRegistrationId === preview.registrationId}>{label(viewSettings, 'Confirm and save entry', '確認並儲存項目')}</button>
              </form>
              <button className="text-button" type="button" onClick={() => void discardPairing()}>{label(viewSettings, 'Discard pairing preview', '丟棄配對預覽')}</button>
            </>}
          </div>
        </div>}
      </section>
      <section className="settings-card" {...el('settings-card')}>
        <div className="section-heading"><div><h2>{label(viewSettings, 'Saved entries', '已儲存項目')}</h2><p className="supporting">{label(viewSettings, 'Current codes and countdowns are calculated in the main process; the renderer receives metadata and code display only.', '目前驗證碼同倒數由主程序計算；renderer 只會收到 metadata 同驗證碼顯示。')}</p></div><button className="text-button" type="button" onClick={() => void authenticator.refresh()} disabled={authenticator.listLoading}>{label(viewSettings, 'Refresh codes', '重新整理驗證碼')}</button></div>
        {visibleEntries.length === 0 ? <p className="empty-state compact">{label(viewSettings, 'No saved entries match this search.', '冇已儲存項目配到呢個搜尋。')}</p> : <div className="authenticator-entry-list">{visibleEntries.map((entry) => {
          const seconds = remaining(entry);
          const displayCode = seconds === 0 ? null : entry.code;
          return <article className="authenticator-entry" key={entry.id}>
            <div><h3>{entry.label}</h3><p className="supporting">{entry.issuer ? `${entry.issuer} · ` : ''}{entry.account} · {entry.algorithm.toUpperCase()} · {entry.digits} digits · {entry.periodSeconds}s</p></div>
            <div className="authenticator-code" aria-live="polite" aria-atomic="true" aria-label={label(viewSettings, `Current code ${displayCode ?? 'unavailable'}`, `目前驗證碼 ${displayCode ?? '暫時用唔到'}`)}>{displayCode ?? '—'}</div>
            <p className="supporting">{seconds === null ? label(viewSettings, 'Secret unavailable', '秘密暫時用唔到') : label(viewSettings, `${seconds} seconds until rollover`, `${seconds} 秒後換碼`)}</p>
          </article>;
        })}</div>}
      </section>
    </section>}
  </>;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { FormEvent } from 'react';
import { AUTHENTICATOR_CAMERA_SCAN_MS, type AuthenticatorAlgorithm, type AuthenticatorDigits, type AuthenticatorExportFormat, type AuthenticatorSecretExportFormat, type AuthenticatorRegistrationPreviewResult, type UserSettings } from '../../shared/contracts';
import { SearchBox } from '../components/SearchBox';
import { RegexBuilder } from '../components/RegexBuilder';
import { DestructiveConfirmDialog } from '../components/DestructiveConfirmDialog';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import type { Notify } from '../notify';
import { makeMatcher, useSurfaceSearch } from '../search';
import type { SearchState } from '../search';
import type { AuthenticatorApi } from '../state/use-authenticator';
import { moveAuthenticatorPickerFocus } from '../authenticator-picker-keyboard';
import { selectAuthenticatorRange, toggleAuthenticatorSelection } from '../authenticator-selection';
import { isExternalEditorBridgeAvailable, openExportInVsCode } from '../external-editor';
import { authenticatorRegistrationFailureNotice } from '../authenticator-registration-notifications';
import { classifyAuthenticatorCameraError, decodeAuthenticatorCameraFrame, type AuthenticatorCameraFailureReason } from '../authenticator-camera';

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
  useEffect(() => {
    if (!disabled || !open) return;
    setOpen(false);
    setBuilderOpen(false);
  }, [disabled, open]);

  const close = () => {
    setOpen(false);
    setBuilderOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  const toggleOpen = () => {
    if (open) setBuilderOpen(false);
    setOpen((current) => !current);
  };
  const choose = (option: PickerOption) => {
    if (disabled) return;
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
    if (disabled) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('.regex-builder')) return;
    if (event.key === 'Escape') { event.preventDefault(); setQuery(''); setRegex(null); close(); return; }
    const targetRole = target?.getAttribute('role');
    const isSearchInput = target?.matches('input[type="search"]') ?? false;
    if (targetRole !== 'option' && targetRole !== 'listbox' && !isSearchInput) return;
    if (!visibleOptions.length) return;
    const nextIndex = moveAuthenticatorPickerFocus(event.key, activeIndex, visibleOptions.length);
    if (nextIndex !== null) { event.preventDefault(); setActiveIndex(nextIndex); return; }
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
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={label(settings, `${labelText}: ${selected?.label ?? ''}`, `${labelText}：${selected?.label ?? ''}`)}
      onClick={toggleOpen}
      onKeyDown={onTriggerKeyDown}
    >
      <span>{selected?.label ?? ''}</span><Icon>expand_more</Icon>
    </button>
    {open && !disabled && <section className="popover authenticator-picker-popover" role="dialog" aria-label={label(settings, `${labelText} picker`, `${labelText}選擇器`)} onKeyDown={onListKeyDown}>
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
        {(query || regex) && <button type="button" className="icon-button" aria-label={label(settings, `Clear ${labelText.toLocaleLowerCase()} filter`, `清除${labelText}篩選`)} onClick={() => { setQuery(''); setRegex(null); window.setTimeout(() => inputRef.current?.focus(), 0); }}><Icon>close</Icon></button>}
        <button className="icon-button" type="button" aria-label={label(settings, `Open regex builder for ${labelText}`, `開啟${labelText}正則建造器`)} aria-expanded={builderOpen} onClick={() => setBuilderOpen((current) => !current)}><Icon>regular_expression</Icon></button>
        {builderOpen && <RegexBuilder query={query} initialPattern={regex?.pattern} initialFlags={regex?.flags} settings={settings} onClose={() => { setBuilderOpen(false); window.setTimeout(() => inputRef.current?.focus(), 0); }} onApply={(pattern, flags) => { setQuery(pattern); setRegex({ pattern, flags }); setBuilderOpen(false); window.setTimeout(() => inputRef.current?.focus(), 0); }} />}
      </div>
      <div id={`${id}-options`} className="authenticator-picker-list" role="listbox" aria-label={labelText}>
        {visibleOptions.length === 0 ? <p className="empty-state compact" role="status">{label(settings, 'No matching options.', '冇配到嘅選項。')}</p> : <>
          <p className="supporting authenticator-picker-result-count" role="status">{label(settings, `${visibleOptions.length} matching options`, `有${visibleOptions.length}個配到嘅選項`)}</p>
          {visibleOptions.map((option, index) => <button
          type="button"
          role="option"
          id={`${id}-option-${String(option.value)}`}
          aria-selected={option.value === value}
          className={index === activeIndex ? 'authenticator-picker-option active' : 'authenticator-picker-option'}
          key={String(option.value)}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(option)}
        >{option.label}</button>)}
        </>}
      </div>
    </section>}
  </div>;
}

function remaining(entry: AuthenticatorApi['entries'][number]): number | null {
  if (!entry.expiresAt) return entry.remainingSeconds;
  return Math.max(0, Math.ceil((Date.parse(entry.expiresAt) - Date.now()) / 1_000));
}

function rolloverPeekIsFresh(entry: AuthenticatorApi['entries'][number], now = Date.now()): boolean {
  if (!entry.nextCode || !entry.expiresAt || !Number.isFinite(now)) return false;
  const expiresAtMs = Date.parse(entry.expiresAt);
  return Number.isFinite(expiresAtMs)
    && now >= expiresAtMs
    && now < expiresAtMs + entry.periodSeconds * 1_000;
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
  const [importingClipboard, setImportingClipboard] = useState(false);
  const [importingQrImage, setImportingQrImage] = useState(false);
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'scanning' | 'decoded' | AuthenticatorCameraFailureReason>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraTriggerRef = useRef<HTMLButtonElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraSessionIdRef = useRef<string | null>(null);
  const cameraTimerRef = useRef<number | null>(null);
  const cameraGenerationRef = useRef(0);
  const uriInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<AuthenticatorRegistrationPreviewResult | null>(null);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [preparingRegistration, setPreparingRegistration] = useState(false);
  const [confirmingRegistrationId, setConfirmingRegistrationId] = useState<string | null>(null);
  const [uncertainRegistrationId, setUncertainRegistrationId] = useState<string | null>(null);
  const prepareGeneration = useRef(0);
  const [clock, setClock] = useState(0);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const shiftSelectionHandled = useRef(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [newGroupName, setNewGroupName] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupBuilderOpen, setGroupBuilderOpen] = useState(false);
  const [groupRegex, setGroupRegex] = useState<SearchState['regex']>(null);
  const [groupDeleteTarget, setGroupDeleteTarget] = useState<string | null>(null);
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const [movePickerQuery, setMovePickerQuery] = useState('');
  const [movePickerRegex, setMovePickerRegex] = useState<SearchState['regex']>(null);
  const [movePickerBuilderOpen, setMovePickerBuilderOpen] = useState(false);
  const [movePickerActiveIndex, setMovePickerActiveIndex] = useState(0);
  const movePickerTriggerRef = useRef<HTMLButtonElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [secretExportOpen, setSecretExportOpen] = useState(false);
  const [secretExportFormat, setSecretExportFormat] = useState<AuthenticatorSecretExportFormat>('json');
  const [exportFormat, setExportFormat] = useState<AuthenticatorExportFormat>('json');
  const viewSettings = settings;
  const visible = matcher('Authenticator registration otpauth URI Base32 secret issuer account algorithm digits period credential vault QR pairing current code countdown saved entries local search rename delete reorder group group label save group move up move down select bulk export refresh metadata secret export warning 改名 刪除 排序 分組 揀選 匯出');
  const visibleEntries = useMemo(() => {
    const collapsedGroupIds = new Set(authenticator.groups.filter((group) => group.collapsed).map((group) => group.id));
    return authenticator.entries.filter((entry) => !entry.groupId || !collapsedGroupIds.has(entry.groupId)).filter((entry) => matcher(`${entry.label} ${entry.issuer} ${entry.account} ${entry.group ?? ''} ${entry.algorithm} ${entry.digits} ${entry.periodSeconds} rename delete reorder group group label save group move up move down select bulk export refresh metadata secret export warning 改名 刪除 排序 分組 揀選 匯出`));
  }, [authenticator.entries, authenticator.groups, matcher, clock]);
  const visibleGroups = useMemo(() => authenticator.groups.filter((group) => makeMatcher({ query: groupSearch, regex: groupRegex })(`${group.name} ${group.color}`)), [authenticator.groups, groupSearch, groupRegex]);
  const moveTargets = useMemo(() => [{ id: null, name: label(viewSettings, 'Ungrouped', '未分組'), color: 'transparent', order: -1, collapsed: false }, ...authenticator.groups].filter((group) => makeMatcher({ query: movePickerQuery, regex: movePickerRegex })(`${group.name} ${group.color}`)), [authenticator.groups, movePickerQuery, movePickerRegex, viewSettings]);
  const selectedVisibleIds = useMemo(() => visibleEntries.map((entry) => entry.id).filter((id) => selectedEntries.has(id)), [selectedEntries, visibleEntries]);
  const searchFingerprint = `${search.state.query}\u0000${search.state.regex?.pattern ?? ''}\u0000${search.state.regex?.flags ?? ''}`;
  const previousSearchFingerprint = useRef(searchFingerprint);
  useEffect(() => {
    if (previousSearchFingerprint.current === searchFingerprint) return;
    previousSearchFingerprint.current = searchFingerprint;
    setSelectionAnchorId(null);
    const visibleIds = new Set(visibleEntries.map((entry) => entry.id));
    setSelectedEntries((current) => new Set([...current].filter((id) => visibleIds.has(id))));
  }, [searchFingerprint, visibleEntries]);

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
    if (preparingRegistration) return;
    const generation = ++prepareGeneration.current;
    const attemptId = globalThis.crypto.randomUUID();
    setPreparingRegistration(true);
    const request = source === 'otpauth-uri'
      ? { source, uri, attemptId }
      : { source, attemptId, secret, issuer, account, algorithm, digits, periodSeconds };
    try {
      const next = await authenticator.prepare(request);
      if (generation !== prepareGeneration.current) return;
      setPreview(next);
      setConfirmationCode('');
      setShowSecret(false);
      setUncertainRegistrationId(null);
      notify({ ok: next.ok, category: next.ok ? 'success' : 'error', title: label(viewSettings, next.ok ? 'Authenticator pairing ready' : 'Authenticator registration needs attention', next.ok ? '驗證器配對準備好' : '驗證器註冊要留意'), message: label(viewSettings, next.message, next.messageYue) });
    } catch (error) {
      if (generation !== prepareGeneration.current) return;
      const failure = authenticatorRegistrationFailureNotice('prepare', error);
      notify({ ok: false, category: 'error', title: label(viewSettings, failure.title, failure.titleYue), message: label(viewSettings, failure.message, failure.messageYue) });
    } finally {
      if (generation === prepareGeneration.current) setPreparingRegistration(false);
    }
  };

  const confirmRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const registrationId = preview?.registrationId;
    if (!registrationId || confirmingRegistrationId === registrationId) return;
    setConfirmingRegistrationId(registrationId);
    try {
      const next = await authenticator.confirm({ registrationId, code: confirmationCode });
      notify({ ok: next.ok, category: next.ok ? 'success' : 'error', title: label(viewSettings, next.ok ? 'Authenticator entry saved' : 'Authenticator confirmation needs attention', next.ok ? '驗證器項目已儲存' : '驗證器確認要留意'), message: label(viewSettings, next.message, next.messageYue) });
      setUncertainRegistrationId(next.uncertain ? registrationId : null);
      if (next.ok) {
        setPreview(null);
        setSecret('');
        setUri('');
        setIssuer('');
        setAccount('');
        setConfirmationCode('');
        setShowSecret(false);
        setUncertainRegistrationId(null);
      }
    } catch (error) {
      const failure = authenticatorRegistrationFailureNotice('confirm', error);
      notify({ ok: false, category: 'error', title: label(viewSettings, failure.title, failure.titleYue), message: label(viewSettings, failure.message, failure.messageYue) });
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
      setUncertainRegistrationId(null);
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
  const importUriFromClipboard = async () => {
    if (importingClipboard || preparingRegistration || preview?.ok) return;
    setImportingClipboard(true);
    const attemptId = globalThis.crypto.randomUUID();
    try {
      prepareGeneration.current += 1;
      const imported = await window.dingDingStore.authenticator.prepareFromClipboard(attemptId);
      setSource('otpauth-uri'); setPreview(imported); setConfirmationCode(''); setShowSecret(false); setUncertainRegistrationId(null);
      window.setTimeout(() => document.getElementById(imported.ok ? 'authenticator-confirm-code' : 'authenticator-uri')?.focus(), 0);
      notify({ ok: imported.ok, category: imported.ok ? 'success' : 'error', message: label(viewSettings, imported.ok ? 'The clipboard URI is ready for pairing confirmation.' : imported.message, imported.ok ? '剪貼簿 URI 已準備好確認配對。' : imported.messageYue) });
    } catch (error) {
      try { await window.dingDingStore.authenticator.cancelAttempt(attemptId); } catch { /* preserve the original transport error */ }
      notify({ ok: false, category: 'error', title: label(viewSettings, 'Clipboard import needs attention', '剪貼簿匯入要留意'), message: label(viewSettings, error instanceof Error ? error.message : 'The local clipboard could not be imported.', '未能匯入本機剪貼簿內容。') });
    } finally { setImportingClipboard(false); }
  };
  const importUriFromQrImage = async () => {
    if (importingQrImage || importingClipboard || preparingRegistration || preview?.ok) return;
    setImportingQrImage(true);
    try {
      const result = await window.dingDingStore.authenticator.importQrImage();
      if (!result.ok || !result.uri) {
        notify({ ok: false, category: 'error', title: label(viewSettings, result.reason === 'cancelled' ? 'QR image import cancelled' : 'QR image import needs attention', result.reason === 'cancelled' ? 'QR 圖片匯入已取消' : 'QR 圖片匯入要留意'), message: label(viewSettings, result.message, result.messageYue) });
        return;
      }
      prepareGeneration.current += 1;
      setSource('otpauth-uri'); setUri(result.uri); setPreview(null); setConfirmationCode(''); setShowSecret(false); setUncertainRegistrationId(null);
      window.setTimeout(() => uriInputRef.current?.focus(), 0);
      notify({ ok: true, message: label(viewSettings, 'A local QR image was decoded. Review the otpauth URI before preparing pairing.', '本機 QR 圖片已解碼。準備配對前請先檢查 otpauth URI。') });
    } catch {
      notify({ ok: false, category: 'error', title: label(viewSettings, 'QR image import unavailable', 'QR 圖片匯入暫時用唔到'), message: label(viewSettings, 'The local QR image bridge was unavailable; no file or secret was imported.', '本機 QR 圖片橋接暫時用唔到；冇匯入檔案或者秘密。') });
    } finally {
      setImportingQrImage(false);
    }
  };

  const stopCamera = async (next: 'idle' | 'decoded' | AuthenticatorCameraFailureReason = 'cancelled', message = '') => {
    cameraGenerationRef.current += 1;
    if (cameraTimerRef.current !== null) window.clearTimeout(cameraTimerRef.current);
    cameraTimerRef.current = null;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    const sessionId = cameraSessionIdRef.current;
    cameraSessionIdRef.current = null;
    if (sessionId) try { await window.dingDingStore.authenticator.stopCameraSession({ sessionId }); } catch { /* local tracks already stopped */ }
    setCameraState(next); setCameraMessage(message);
    if (next !== 'idle') window.setTimeout(() => cameraTriggerRef.current?.focus(), 0);
  };

  const startCameraScan = async () => {
    if (cameraState === 'requesting' || cameraState === 'scanning' || importingClipboard || importingQrImage || preparingRegistration || preview?.ok) return;
    if (!document.hasFocus()) { setCameraState('focus-required'); setCameraMessage(label(viewSettings, 'Focus the App Store, then try the camera again.', '將 App Store 設為目前視窗，然後再試相機。')); return; }
    setCameraState('requesting'); setCameraMessage(label(viewSettings, 'Requesting one local video stream…', '要求緊一個本機視訊串流…'));
    const generation = ++cameraGenerationRef.current;
    try {
      const lease = await window.dingDingStore.authenticator.startCameraSession();
      if (generation !== cameraGenerationRef.current) { if (lease.ok) try { await window.dingDingStore.authenticator.stopCameraSession({ sessionId: lease.sessionId }); } catch { /* cancellation already won */ } return; }
      if (!lease.ok) { setCameraState(lease.reason === 'focus-required' ? 'focus-required' : lease.reason === 'restricted' ? 'cancelled' : 'no-camera'); setCameraMessage(label(viewSettings, lease.message, lease.messageYue)); return; }
      cameraSessionIdRef.current = lease.sessionId;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1024, max: 1024 }, height: { ideal: 1024, max: 1024 } } });
      if (generation !== cameraGenerationRef.current) { stream.getTracks().forEach((track) => track.stop()); try { await window.dingDingStore.authenticator.stopCameraSession({ sessionId: lease.sessionId }); } catch { /* cancellation already won */ } return; }
      cameraStreamRef.current = stream;
      const video = cameraVideoRef.current;
      if (!video) { await stopCamera('no-camera', label(viewSettings, 'The camera preview was unavailable.', '相機預覽暫時用唔到。')); return; }
      video.srcObject = stream; await video.play();
      setCameraState('scanning'); setCameraMessage(label(viewSettings, 'Scanning locally. Hold an otpauth QR code inside the frame.', '喺本機掃描緊。將 otpauth QR code 放入框內。'));
      const startedAt = Date.now();
      const sample = () => {
        if (generation !== cameraGenerationRef.current) return;
        const currentVideo = cameraVideoRef.current;
        if (!cameraStreamRef.current || !currentVideo) return;
        if (!document.hasFocus() || document.visibilityState !== 'visible') { void stopCamera('focus-required', label(viewSettings, 'Camera scanning stopped when the app lost focus.', 'App Store 失去焦點，相機掃描已停止。')); return; }
        if (Date.now() - startedAt >= AUTHENTICATOR_CAMERA_SCAN_MS) { void stopCamera('timeout', label(viewSettings, 'No QR code was found within 30 seconds. Try again or use an image file.', '30 秒內搵唔到 QR code。請重試或者用圖片檔案。')); return; }
        if (currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0) {
          const scale = Math.min(1, 1024 / Math.max(currentVideo.videoWidth, currentVideo.videoHeight));
          const width = Math.max(1, Math.floor(currentVideo.videoWidth * scale)); const height = Math.max(1, Math.floor(currentVideo.videoHeight * scale));
          const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
          const context = canvas.getContext('2d');
          let decoded: string | null = null;
          try { context?.drawImage(currentVideo, 0, 0, width, height); decoded = context ? decodeAuthenticatorCameraFrame(context.getImageData(0, 0, width, height).data, width, height) : null; }
          catch { canvas.width = 0; canvas.height = 0; void stopCamera('decode-failed', label(viewSettings, 'The local camera frame could not be decoded. Try again or use an image file.', '本機相機畫面未能解碼。請重試或者用圖片檔案。')); return; }
          canvas.width = 0; canvas.height = 0;
          if (decoded) {
            prepareGeneration.current += 1; setSource('otpauth-uri'); setUri(decoded); setPreview(null); setConfirmationCode(''); setShowSecret(false); setUncertainRegistrationId(null);
            void stopCamera('decoded', label(viewSettings, 'The QR code was decoded locally. Review the hidden URI before pairing.', 'QR code 已喺本機解碼。配對前請檢查收埋咗嘅 URI。'));
            window.setTimeout(() => uriInputRef.current?.focus(), 0); return;
          }
        }
        cameraTimerRef.current = window.setTimeout(sample, 150);
      };
      sample();
    } catch (error) {
      const reason = classifyAuthenticatorCameraError(error);
      await stopCamera(reason, reason === 'permission-denied' ? label(viewSettings, 'Camera permission was denied. No image or secret was retained.', '相機權限被拒絕。冇保留圖片或者秘密。') : label(viewSettings, 'No usable camera was available. You can still import an image file.', '冇可用相機。你仍然可以匯入圖片檔案。'));
    }
  };

  useEffect(() => () => { cameraGenerationRef.current += 1; if (cameraTimerRef.current !== null) window.clearTimeout(cameraTimerRef.current); cameraStreamRef.current?.getTracks().forEach((track) => track.stop()); const sessionId = cameraSessionIdRef.current; if (sessionId) void window.dingDingStore.authenticator.stopCameraSession({ sessionId }); }, []);
  useEffect(() => { const onHidden = () => { if (document.visibilityState !== 'visible' && cameraStreamRef.current) void stopCamera('focus-required', label(viewSettings, 'Camera scanning stopped when the app was hidden.', 'App Store 收埋時，相機掃描已停止。')); }; document.addEventListener('visibilitychange', onHidden); return () => document.removeEventListener('visibilitychange', onHidden); }, [viewSettings]);

  const mutationNotice = (result: { ok: boolean; message: string; messageYue: string }) => notify({ ok: result.ok, message: label(viewSettings, result.message, result.messageYue) });
  const renameEntry = async (entryId: string) => {
    try {
      const result = await authenticator.rename({ entryId, label: labelDrafts[entryId] ?? '' });
      mutationNotice(result);
      if (result.ok) setEditingLabelId(null);
    } catch { notify({ ok: false, message: label(viewSettings, 'The authenticator rename bridge was unavailable; no change was claimed.', '驗證器改名橋接暫時用唔到；冇聲稱已改動。') }); }
  };
  const setEntryGroup = async (entryId: string) => {
    try {
      const result = await authenticator.setGroup({ entryId, group: (groupDrafts[entryId] ?? '').trim() || null });
      mutationNotice(result);
      if (result.ok) setGroupDrafts((current) => ({ ...current, [entryId]: result.entry?.group ?? '' }));
    } catch { notify({ ok: false, message: label(viewSettings, 'The authenticator group bridge was unavailable; no change was claimed.', '驗證器分組橋接暫時用唔到；冇聲稱已改動。') }); }
  };
  const moveEntry = async (entryId: string, order: number) => {
    try {
      const result = await authenticator.reorder({ entryId, order });
      mutationNotice(result);
    } catch { notify({ ok: false, message: label(viewSettings, 'The authenticator reorder bridge was unavailable; no change was claimed.', '驗證器排序橋接暫時用唔到；冇聲稱已改動。') }); }
  };
  const downloadMetadata = async () => {
    if (!selectedVisibleIds.length) return;
    try {
      const result = await authenticator.export({ entryIds: selectedVisibleIds, format: exportFormat });
      mutationNotice(result);
      if (!result.ok || !result.content || !result.filename) return;
      const blob = new Blob([result.content], { type: exportFormat === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch { notify({ ok: false, message: label(viewSettings, 'The authenticator metadata export bridge was unavailable; no file was created.', '驗證器 metadata 匯出橋接暫時用唔到；冇建立檔案。') }); }
  };
  const openMetadataInVsCode = async () => {
    if (!selectedVisibleIds.length || !isExternalEditorBridgeAvailable()) return;
    try {
      const result = await authenticator.export({ entryIds: selectedVisibleIds, format: exportFormat });
      mutationNotice(result);
      if (!result.ok || !result.content || !result.filename) return;
      const mime = exportFormat === 'json' ? 'application/json' : exportFormat === 'csv' ? 'text/csv' : 'text/markdown';
      const opened = await openExportInVsCode({ recordKind: 'authenticator', suggestedName: result.filename, mime, content: result.content });
      notify({ ok: opened.ok, message: opened.ok ? label(viewSettings, 'Authenticator metadata export opened in Visual Studio Code.', '已喺 Visual Studio Code 開啟 authenticator metadata 匯出。') : opened.message });
    } catch { notify({ ok: false, message: label(viewSettings, 'The authenticator Visual Studio Code export bridge was unavailable; no open was claimed.', '驗證器 Visual Studio Code 匯出橋接暫時用唔到；冇聲稱已開啟。') }); }
  };
  const exportSecrets = async () => {
    if (!selectedVisibleIds.length) return;
    try {
      const authorization = await authenticator.authorizeSecretExport({ entryIds: selectedVisibleIds, format: secretExportFormat });
      if (!authorization.ok || !authorization.authorizationToken) { notify({ ok: false, message: label(viewSettings, authorization.message, authorization.messageYue) }); return; }
      const result = await authenticator.secretExport({ entryIds: selectedVisibleIds, format: secretExportFormat, authorizationToken: authorization.authorizationToken });
      notify({ ok: result.ok, message: label(viewSettings, result.message, result.messageYue) });
      if (result.ok) { setSecretExportOpen(false); setSelectedEntries(new Set()); }
    } catch { notify({ ok: false, message: label(viewSettings, 'The secret export bridge was unavailable; no file was created.', '秘密匯出橋接暫時用唔到；冇建立檔案。') }); }
  };
  const deleteEntry = async (entryId: string) => {
    try {
      const result = await authenticator.remove({ entryId, confirmed: true });
      if (result.uncertain) {
        if (result.deletedId) setSelectedEntries((current) => new Set(current).add(result.deletedId!));
        setSelectionAnchorId(null);
        mutationNotice({ ...result, ok: false, message: label(viewSettings, 'Deletion reached an uncertain vault state; the entry remains selected for review and must not be retried yet.', '刪除令憑證庫狀態未能確定；項目保持揀選畀你檢查，暫時唔好重試。'), messageYue: '刪除令憑證庫狀態未能確定；項目保持揀選畀你檢查，暫時唔好重試。' });
        return;
      }
      mutationNotice(result);
      if (result.ok) {
        setSelectionAnchorId(null);
        setSelectedEntries((current) => { const next = new Set(current); next.delete(entryId); return next; });
        setDeleteTarget(null);
      }
    } catch { notify({ ok: false, message: label(viewSettings, 'The authenticator delete bridge was unavailable; the entry remains selected.', '驗證器刪除橋接暫時用唔到；項目仍然揀住。') }); }
  };
  const deleteSelected = async () => {
    if (!selectedVisibleIds.length) return;
    try {
      const result = await authenticator.bulkRemove({ entryIds: selectedVisibleIds, confirmed: true });
      mutationNotice(result);
      setSelectionAnchorId(null);
      if (result.deletedIds.length || result.uncertainIds.length) setSelectedEntries((current) => { const next = new Set(current); for (const id of result.deletedIds) if (!result.uncertainIds.includes(id)) next.delete(id); for (const id of result.uncertainIds) next.add(id); return next; });
      if (result.ok) setBulkDeleteOpen(false);
    } catch { notify({ ok: false, message: label(viewSettings, 'The authenticator bulk-delete bridge was unavailable; the selection remains for review.', '驗證器批量刪除橋接暫時用唔到；揀選保留畀你檢查。') }); }
  };
  useEffect(() => {
    const liveIds = new Set(authenticator.entries.map((entry) => entry.id));
    setSelectionAnchorId(null);
    setSelectedEntries((current) => new Set([...current].filter((id) => liveIds.has(id))));
    setLabelDrafts((current) => Object.fromEntries(authenticator.entries.map((entry) => [entry.id, current[entry.id] ?? entry.label])));
    setGroupDrafts((current) => Object.fromEntries(authenticator.entries.map((entry) => [entry.id, current[entry.id] ?? entry.group ?? ''])));
  }, [authenticator.entries]);

  const visibleEntryIds = useMemo(() => visibleEntries.map((entry) => entry.id), [visibleEntries]);
  const selectVisibleRange = (entryId: string) => {
    setSelectedEntries((current) => selectAuthenticatorRange(visibleEntryIds, selectionAnchorId, entryId, current));
    setSelectionAnchorId(entryId);
  };
  const toggleVisibleEntry = (entryId: string, checked: boolean) => {
    setSelectedEntries((current) => toggleAuthenticatorSelection(current, entryId, checked));
    setSelectionAnchorId(entryId);
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
         <p className="supporting">{label(viewSettings, 'This bounded slice supports local camera and QR image import, metadata-only management, groups, selection, redacted export, deliberate secret export, and a next-code peek. Protected authenticator history restore is unavailable on this production host until a reviewed native no-follow vault adapter exists.', '呢個有限功能支援本機相機同 QR 圖片匯入、淨 metadata 管理、分組、揀選、淨 metadata 匯出、刻意秘密匯出同下一碼預覽。呢部生產機未有受保護 authenticator 歷史還原，要等已審核嘅 native no-follow 憑證庫配接器先可以用。')}</p>
      </section>
      <section className="settings-card" {...el('settings-card')}>
        <h2>{label(viewSettings, 'Register an authenticator entry', '註冊 authenticator 項目')}</h2>
        <div className="button-row" aria-live="polite"><button className="text-button" type="button" onClick={() => void importUriFromClipboard()} disabled={importingClipboard || importingQrImage || cameraState === 'requesting' || cameraState === 'scanning' || preparingRegistration || Boolean(preview?.ok)} aria-busy={importingClipboard}>{importingClipboard ? label(viewSettings, 'Reading local clipboard…', '讀取緊本機剪貼簿…') : label(viewSettings, 'Import otpauth URI from clipboard', '由剪貼簿匯入 otpauth URI')}</button><button className="text-button" type="button" onClick={() => void importUriFromQrImage()} disabled={importingQrImage || importingClipboard || cameraState === 'requesting' || cameraState === 'scanning' || preparingRegistration || Boolean(preview?.ok)} aria-busy={importingQrImage}>{importingQrImage ? label(viewSettings, 'Reading local QR image…', '讀取緊本機 QR 圖片…') : label(viewSettings, 'Import otpauth URI from QR image file', '由 QR 圖片檔案匯入 otpauth URI')}</button><button ref={cameraTriggerRef} className="text-button" type="button" onClick={() => void startCameraScan()} disabled={cameraState === 'requesting' || cameraState === 'scanning' || importingQrImage || importingClipboard || preparingRegistration || Boolean(preview?.ok)} aria-busy={cameraState === 'requesting'}>{cameraState === 'requesting' ? label(viewSettings, 'Requesting camera…', '要求緊相機…') : label(viewSettings, 'Scan QR with camera', '用相機掃描 QR')}</button></div>
        <div className={`authenticator-camera ${cameraState === 'scanning' ? 'active' : ''}`} role="region" aria-label={label(viewSettings, 'Local authenticator camera scanner', '本機 authenticator 相機掃描器')}>
          <video ref={cameraVideoRef} muted playsInline aria-label={label(viewSettings, 'Live local camera preview for QR scanning', 'QR 掃描本機即時相機預覽')} />
          <p className="supporting" role={cameraState === 'permission-denied' || cameraState === 'no-camera' || cameraState === 'timeout' || cameraState === 'focus-required' ? 'alert' : 'status'}>{cameraMessage || label(viewSettings, 'Camera stays off until you choose Scan QR with camera. Frames are decoded locally and are never sent through the bridge or network.', '你揀「用相機掃描 QR」之前，相機會保持關閉。畫面只喺本機解碼，唔會經橋接或者網絡傳送。')}</p>
          {(cameraState === 'requesting' || cameraState === 'scanning') && <button className="text-button" type="button" onClick={() => void stopCamera('cancelled', label(viewSettings, 'Camera scanning was cancelled. No frame was retained.', '相機掃描已取消。冇保留畫面。'))}>{label(viewSettings, 'Cancel camera scan', '取消相機掃描')}</button>}
        </div>
        {preview?.ok && <p className="supporting">{label(viewSettings, 'Registration fields are locked while this pairing preview is active, so the QR, code, and metadata cannot drift apart.', '配對預覽進行中會鎖住註冊欄位，避免 QR、驗證碼同 metadata 對唔上。')}</p>}
        <form onSubmit={(event) => void submitRegistration(event)}>
          <AuthenticatorPicker
            id="authenticator-source"
            labelText={label(viewSettings, 'Registration source', '註冊來源')}
            settings={viewSettings}
            value={source}
            disabled={Boolean(preview?.ok) || preparingRegistration}
            options={[{ value: 'manual', label: label(viewSettings, 'Manual Base32 metadata', '手動 Base32 metadata') }, { value: 'otpauth-uri', label: 'otpauth://totp/ URI' }]}
            onChange={(value) => { prepareGeneration.current += 1; setSource(value as typeof source); setPreview(null); setSecret(''); setUri(''); setShowSecret(false); setUncertainRegistrationId(null); }}
          />
          {source === 'otpauth-uri' ? <>
            <label htmlFor="authenticator-uri">{label(viewSettings, 'otpauth://totp/ URI (hidden until reveal)', 'otpauth://totp/ URI（顯示前會收埋）')}<input ref={uriInputRef} id="authenticator-uri" disabled={Boolean(preview?.ok) || preparingRegistration} type={showSecret ? 'text' : 'password'} autoComplete="off" maxLength={2_048} value={uri} onChange={(event) => setUri(event.target.value)} required /></label>
            <div className="button-row">
              <button className="text-button" type="button" disabled={preparingRegistration} onClick={() => setShowSecret((value) => !value)}>{showSecret ? label(viewSettings, 'Hide otpauth URI', '收埋 otpauth URI') : label(viewSettings, 'Reveal otpauth URI', '顯示 otpauth URI')}</button>
              <button className="text-button" type="button" disabled={preparingRegistration || !showSecret || !uri} onClick={() => void copyRegistrationUri()}>{label(viewSettings, 'Copy otpauth URI', '複製 otpauth URI')}</button>
            </div>
          </> : <>
            <label htmlFor="authenticator-secret">{label(viewSettings, 'Base32 secret (cleared after pairing)', 'Base32 秘密（配對後清走）')}<input id="authenticator-secret" disabled={Boolean(preview?.ok) || preparingRegistration} type={showSecret ? 'text' : 'password'} autoComplete="off" maxLength={256} value={secret} onChange={(event) => setSecret(event.target.value)} required /></label>
            <button className="text-button" type="button" disabled={Boolean(preview?.ok) || preparingRegistration} onClick={() => setShowSecret((value) => !value)}>{showSecret ? label(viewSettings, 'Hide manual secret', '收埋手動秘密') : label(viewSettings, 'Reveal manual secret', '顯示手動秘密')}</button>
            <label htmlFor="authenticator-issuer">{label(viewSettings, 'Issuer (optional)', 'Issuer（可選）')}<input id="authenticator-issuer" disabled={Boolean(preview?.ok) || preparingRegistration} type="text" maxLength={128} value={issuer} onChange={(event) => setIssuer(event.target.value)} /></label>
            <label htmlFor="authenticator-account">{label(viewSettings, 'Account', '帳戶')}<input id="authenticator-account" disabled={Boolean(preview?.ok) || preparingRegistration} type="text" maxLength={256} value={account} onChange={(event) => setAccount(event.target.value)} required /></label>
            <AuthenticatorPicker
              id="authenticator-algorithm"
              labelText={label(viewSettings, 'Algorithm', '演算法')}
              settings={viewSettings}
              value={algorithm}
              disabled={Boolean(preview?.ok) || preparingRegistration}
              options={ALGORITHMS.map((item) => ({ value: item.value, label: label(viewSettings, item.en, item.yue) }))}
              onChange={(value) => setAlgorithm(value as AuthenticatorAlgorithm)}
            />
            <AuthenticatorPicker
              id="authenticator-digits"
              labelText={label(viewSettings, 'Digits', '位數')}
              settings={viewSettings}
              value={digits}
              disabled={Boolean(preview?.ok) || preparingRegistration}
              options={DIGITS.map((value) => ({ value, label: String(value) }))}
              onChange={(value) => setDigits(Number(value) as AuthenticatorDigits)}
            />
            <label htmlFor="authenticator-period">{label(viewSettings, 'Period in seconds', '週期秒數')}<input id="authenticator-period" disabled={Boolean(preview?.ok) || preparingRegistration} type="number" min={1} max={3600} step={1} value={periodSeconds} onChange={(event) => setPeriodSeconds(Number(event.target.value))} /></label>
          </>}
          <button className="filled-button" type="submit" disabled={authenticator.loading || preparingRegistration || Boolean(preview?.ok) || (source === 'manual' ? !secret.trim() || !account.trim() : !uri.trim())}>{preparingRegistration ? label(viewSettings, 'Preparing local QR pairing…', '準備緊本機 QR 配對…') : label(viewSettings, 'Prepare local QR pairing', '準備本機 QR 配對')}</button>
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
                {uncertainRegistrationId === preview.registrationId && <p className="supporting" role="alert">{label(viewSettings, 'This pairing result is uncertain; do not retry it. Refresh the saved-entry list or discard this preview.', '呢個配對結果未能確定；唔好重試。請重新整理已儲存項目清單，或者丟棄呢個預覽。')}</p>}
                <button className="filled-button" type="submit" disabled={!confirmationCode || confirmingRegistrationId === preview.registrationId || uncertainRegistrationId === preview.registrationId} title={uncertainRegistrationId === preview.registrationId ? label(viewSettings, 'Unavailable: the previous pairing result is uncertain; refresh or discard it first.', '未能使用：上次配對結果未能確定；請先重新整理或者丟棄。') : undefined}>{label(viewSettings, 'Confirm and save entry', '確認並儲存項目')}</button>
              </form>
              <button className="text-button" type="button" onClick={() => void discardPairing()}>{label(viewSettings, 'Discard pairing preview', '丟棄配對預覽')}</button>
            </>}
          </div>
        </div>}
      </section>
      <section className="settings-card" {...el('settings-card')}>
        <div className="section-heading"><div><h2>{label(viewSettings, 'Saved entries', '已儲存項目')}</h2><p className="supporting">{label(viewSettings, 'Current codes and countdowns are calculated in the main process; the renderer receives metadata and code display only.', '目前驗證碼同倒數由主程序計算；renderer 只會收到 metadata 同驗證碼顯示。')}</p></div><button className="text-button" type="button" onClick={() => void authenticator.refresh()} disabled={authenticator.listLoading}>{label(viewSettings, 'Refresh codes', '重新整理驗證碼')}</button></div>
        <div className="settings-card authenticator-groups" role="region" aria-label={label(viewSettings, 'Authenticator groups', 'Authenticator 分組')}>
          <div className="section-heading"><div><h3>{label(viewSettings, 'Stable groups', '穩定分組')}</h3><p className="supporting">{label(viewSettings, 'Groups are local entities. Deleting one leaves its entries ungrouped; secrets and otpauth URIs stay in the credential vault.', '分組係本機實體。刪除分組會保留項目但取消分組；秘密同 otpauth URI 繼續留喺憑證庫。')}</p></div></div>
          <div className="authenticator-picker-search"><Icon>search</Icon><input type="search" value={groupSearch} maxLength={160} aria-label={label(viewSettings, 'Search authenticator groups', '搜尋 Authenticator 分組')} placeholder={label(viewSettings, 'Search groups', '搜尋分組')} onChange={(event) => { setGroupSearch(event.target.value); if (groupRegex) setGroupRegex({ ...groupRegex, pattern: event.target.value }); }} /><button className="icon-button" type="button" aria-label={label(viewSettings, 'Open regex builder for authenticator groups', '開啟 Authenticator 分組正則建造器')} aria-expanded={groupBuilderOpen} onClick={() => setGroupBuilderOpen((current) => !current)}><Icon>regular_expression</Icon></button>{groupBuilderOpen && <RegexBuilder query={groupSearch} initialPattern={groupRegex?.pattern} initialFlags={groupRegex?.flags} settings={viewSettings} onClose={() => setGroupBuilderOpen(false)} onApply={(pattern, flags) => { setGroupSearch(pattern); setGroupRegex({ pattern, flags }); setGroupBuilderOpen(false); }} />}</div>
          <div className="button-row"><input aria-label={label(viewSettings, 'New authenticator group name', '新 Authenticator 分組名稱')} maxLength={64} value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} /><button className="text-button" type="button" disabled={!newGroupName.trim()} onClick={() => void authenticator.createGroup({ name: newGroupName.trim() }).then((result) => { if (result.ok) setNewGroupName(''); })}>{label(viewSettings, 'Create group', '建立分組')}</button></div>
          <div className="command-list" role="listbox" aria-label={label(viewSettings, 'Authenticator group list', 'Authenticator 分組清單')}>
            {visibleGroups.map((group) => <div className="command-row" role="option" aria-selected="false" key={group.id}><span>{group.name} · {group.color} · {authenticator.entries.filter((entry) => entry.groupId === group.id).length} {label(viewSettings, 'entries', '個項目')}</span><button className="text-button" type="button" aria-expanded={!group.collapsed} onClick={() => void authenticator.collapseGroup({ groupId: group.id, collapsed: !group.collapsed })}>{group.collapsed ? label(viewSettings, 'Expand', '展開') : label(viewSettings, 'Collapse', '收合')}</button><button className="text-button" type="button" onClick={() => { const name = window.prompt(label(viewSettings, 'Rename authenticator group', '改名 Authenticator 分組'), group.name); if (name?.trim()) void authenticator.renameGroup({ groupId: group.id, name: name.trim() }); }}>{label(viewSettings, 'Rename', '改名')}</button><button className="text-button" type="button" onClick={() => void authenticator.reorderGroup({ groupId: group.id, order: group.order - 1 })} disabled={group.order === 0}>{label(viewSettings, 'Move up', '上移')}</button><button className="text-button" type="button" onClick={() => void authenticator.reorderGroup({ groupId: group.id, order: group.order + 1 })} disabled={group.order >= authenticator.groups.length - 1}>{label(viewSettings, 'Move down', '下移')}</button><button className="text-button danger" type="button" onClick={() => setGroupDeleteTarget(group.id)}>{label(viewSettings, 'Delete', '刪除')}</button></div>)}
          </div>
          <button ref={movePickerTriggerRef} className="text-button" type="button" disabled={!selectedVisibleIds.length} aria-haspopup="dialog" aria-expanded={movePickerOpen} onClick={() => { setMovePickerOpen(true); setMovePickerActiveIndex(0); }}>{label(viewSettings, `Move ${selectedVisibleIds.length} selected… into group…`, `移動 ${selectedVisibleIds.length} 個已揀項目…去分組…`)}</button>
          {movePickerOpen && <section className="popover authenticator-picker-popover" role="dialog" aria-label={label(viewSettings, 'Move selected authenticator entries into group', '移動已揀 Authenticator 項目去分組')} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setMovePickerOpen(false); setMovePickerBuilderOpen(false); window.setTimeout(() => movePickerTriggerRef.current?.focus(), 0); return; } const next = moveAuthenticatorPickerFocus(event.key, movePickerActiveIndex, moveTargets.length); if (next !== null) { event.preventDefault(); setMovePickerActiveIndex(next); } else if (event.key === 'Enter' && moveTargets[movePickerActiveIndex]) { event.preventDefault(); void authenticator.moveToGroup({ entryIds: selectedVisibleIds, groupId: moveTargets[movePickerActiveIndex].id }).then(() => { setMovePickerOpen(false); window.setTimeout(() => movePickerTriggerRef.current?.focus(), 0); }); } }}>
            <div className="authenticator-picker-search"><Icon>search</Icon><input autoFocus type="search" value={movePickerQuery} maxLength={160} aria-label={label(viewSettings, 'Search move targets', '搜尋移動目標')} aria-controls="authenticator-move-targets" aria-activedescendant={moveTargets[movePickerActiveIndex] ? `authenticator-move-target-${moveTargets[movePickerActiveIndex].id ?? 'ungrouped'}` : undefined} onChange={(event) => { setMovePickerQuery(event.target.value); setMovePickerActiveIndex(0); if (movePickerRegex) setMovePickerRegex({ ...movePickerRegex, pattern: event.target.value }); }} /><button className="icon-button" type="button" aria-label={label(viewSettings, 'Open regex builder for move targets', '開啟移動目標正則建造器')} aria-expanded={movePickerBuilderOpen} onClick={() => setMovePickerBuilderOpen((current) => !current)}><Icon>regular_expression</Icon></button>{movePickerBuilderOpen && <RegexBuilder query={movePickerQuery} initialPattern={movePickerRegex?.pattern} initialFlags={movePickerRegex?.flags} settings={viewSettings} onClose={() => setMovePickerBuilderOpen(false)} onApply={(pattern, flags) => { setMovePickerQuery(pattern); setMovePickerRegex({ pattern, flags }); setMovePickerActiveIndex(0); setMovePickerBuilderOpen(false); }} />}</div>
            <p className="supporting" role="status">{label(viewSettings, `${moveTargets.length} matching targets; ${selectedVisibleIds.length} entries selected.`, `${moveTargets.length} 個配到目標；已揀 ${selectedVisibleIds.length} 個項目。`)}</p>
            <div id="authenticator-move-targets" className="authenticator-picker-list" role="listbox">{moveTargets.length ? moveTargets.map((group, index) => <button id={`authenticator-move-target-${group.id ?? 'ungrouped'}`} key={group.id ?? 'ungrouped'} type="button" role="option" aria-selected={index === movePickerActiveIndex} className={index === movePickerActiveIndex ? 'authenticator-picker-option active' : 'authenticator-picker-option'} onMouseEnter={() => setMovePickerActiveIndex(index)} onClick={() => void authenticator.moveToGroup({ entryIds: selectedVisibleIds, groupId: group.id }).then(() => { setMovePickerOpen(false); window.setTimeout(() => movePickerTriggerRef.current?.focus(), 0); })}><span>{group.name}</span><small>{group.id ? `${group.color} · ${authenticator.entries.filter((entry) => entry.groupId === group.id).length} ${label(viewSettings, 'entries', '個項目')}` : label(viewSettings, 'Remove group membership', '移除分組成員關係')}</small></button>) : <p className="empty-state compact" role="status">{label(viewSettings, 'No matching groups.', '冇配到嘅分組。')}</p>}</div>
          </section>}
        </div>
        {visibleEntries.length > 0 && <div id="authenticator-entry-management" className="bulk-toolbar" role="group" aria-label={label(viewSettings, 'Authenticator bulk actions', '驗證器批量操作')}>
          <strong aria-live="polite" {...el('authenticator-entry-management')}>{label(viewSettings, `${selectedEntries.size} selected · ${selectedVisibleIds.length} in this view · ${visibleEntries.length} shown`, `揀咗 ${selectedEntries.size} · 呢個畫面有 ${selectedVisibleIds.length} · 顯示 ${visibleEntries.length}`)}</strong>
          <p className="supporting">{label(viewSettings, 'Shift-click or press Shift+Space on a checkbox to select a visible range.', '按住 Shift 再撳 checkbox，或者按 Shift+Space，可以揀選目前顯示嘅範圍。')}</p>
          <button className="text-button" type="button" onClick={() => { setSelectionAnchorId(null); setSelectedEntries((current) => { const next = new Set(current); for (const entry of visibleEntries) next.add(entry.id); return next; }); }}>{label(viewSettings, 'Select all shown', '揀晒目前顯示')}</button>
          <button className="text-button" type="button" onClick={() => { setSelectionAnchorId(null); setSelectedEntries((current) => { const next = new Set(current); for (const entry of visibleEntries) next.has(entry.id) ? next.delete(entry.id) : next.add(entry.id); return next; }); }}>{label(viewSettings, 'Invert shown', '反轉目前顯示')}</button>
          <button className="text-button" type="button" disabled={!selectedVisibleIds.length} onClick={() => { setSelectionAnchorId(null); setSelectedEntries(new Set()); }}>{label(viewSettings, 'Clear selection', '清除揀選')}</button>
          <AuthenticatorPicker id="authenticator-export-format" labelText={label(viewSettings, 'Export format', '匯出格式')} settings={viewSettings} value={exportFormat} disabled={!selectedVisibleIds.length} options={[{ value: 'json', label: 'JSON' }, { value: 'csv', label: 'CSV' }, { value: 'markdown', label: 'Markdown' }]} onChange={(value) => setExportFormat(value as AuthenticatorExportFormat)} />
          <button className="text-button" type="button" disabled={!selectedVisibleIds.length} onClick={() => void downloadMetadata()}>{label(viewSettings, 'Export metadata (secrets omitted)', '匯出 metadata（不包括秘密）')}</button>
          <AuthenticatorPicker id="authenticator-secret-export-format" labelText={label(viewSettings, 'Secret export format', '秘密匯出格式')} settings={viewSettings} value={secretExportFormat} disabled={!selectedVisibleIds.length} options={[{ value: 'json', label: 'JSON' }, { value: 'csv', label: 'CSV' }]} onChange={(value) => setSecretExportFormat(value as AuthenticatorSecretExportFormat)} />
          <button className="text-button danger" type="button" disabled={!selectedVisibleIds.length} onClick={() => setSecretExportOpen(true)}>{label(viewSettings, 'Export secrets…', '匯出秘密…')}</button>
          <button className="text-button" type="button" disabled={!selectedVisibleIds.length || !isExternalEditorBridgeAvailable()} title={isExternalEditorBridgeAvailable() ? undefined : label(viewSettings, 'Unavailable: this build has no validated Visual Studio Code adapter.', '未能使用：呢個版本冇已審核嘅 Visual Studio Code 適配器。')} onClick={() => void openMetadataInVsCode()}>{label(viewSettings, 'Open export in VS Code', '喺 VS Code 開匯出')}</button>
          <button className="text-button danger" type="button" disabled={!selectedVisibleIds.length} onClick={() => setBulkDeleteOpen(true)}>{label(viewSettings, 'Delete selected', '刪除已揀選')}</button>
        </div>}
        {visibleEntries.length === 0 ? <p className="empty-state compact">{label(viewSettings, 'No saved entries match this search.', '冇已儲存項目配到呢個搜尋。')}</p> : <div className="authenticator-entry-list" role="list">{visibleEntries.map((entry) => {
           const seconds = remaining(entry);
           const showingRolloverCode = seconds === 0 && rolloverPeekIsFresh(entry);
           const displayCode = showingRolloverCode ? entry.nextCode : seconds === 0 ? null : entry.code;
          const selected = selectedEntries.has(entry.id);
          return <article className={selected ? 'authenticator-entry selected' : 'authenticator-entry'} key={entry.id} role="listitem" {...el('authenticator-entry')}>
            <div className="authenticator-entry-heading">
              <label className="authenticator-entry-select" {...el('authenticator-entry-select')}><input type="checkbox" checked={selected} aria-label={label(viewSettings, `Select ${entry.label}`, `揀選 ${entry.label}`)} aria-keyshortcuts="Shift+Space" onClick={(event) => { if (!event.shiftKey || shiftSelectionHandled.current) return; shiftSelectionHandled.current = true; event.preventDefault(); event.stopPropagation(); selectVisibleRange(entry.id); void Promise.resolve().then(() => { shiftSelectionHandled.current = false; }); }} onKeyDown={(event) => { if (event.shiftKey && event.key === ' ') { shiftSelectionHandled.current = true; event.preventDefault(); event.stopPropagation(); selectVisibleRange(entry.id); void Promise.resolve().then(() => { shiftSelectionHandled.current = false; }); } }} onChange={(event) => { if (shiftSelectionHandled.current) { shiftSelectionHandled.current = false; return; } toggleVisibleEntry(entry.id, event.target.checked); }} />{label(viewSettings, 'Select', '揀選')}</label>
              {editingLabelId === entry.id ? <div className="button-row"><input aria-label={label(viewSettings, `Rename ${entry.label}`, `改名 ${entry.label}`)} maxLength={512} value={labelDrafts[entry.id] ?? entry.label} onChange={(event) => setLabelDrafts((current) => ({ ...current, [entry.id]: event.target.value }))} /><button className="text-button" type="button" onClick={() => void renameEntry(entry.id)}>{label(viewSettings, 'Save name', '儲存名稱')}</button><button className="text-button" type="button" onClick={() => setEditingLabelId(null)}>{label(viewSettings, 'Cancel', '取消')}</button></div> : <><h3>{entry.label}</h3><button className="text-button" type="button" onClick={() => { setLabelDrafts((current) => ({ ...current, [entry.id]: entry.label })); setEditingLabelId(entry.id); }}>{label(viewSettings, 'Rename', '改名')}</button></>}
              <p className="supporting">{entry.issuer ? `${entry.issuer} · ` : ''}{entry.account} · {entry.algorithm.toUpperCase()} · {entry.digits} digits · {entry.periodSeconds}s{entry.group ? ` · ${label(viewSettings, 'Group', '分組')}: ${entry.group}` : ''}</p>
            </div>
            <div className="authenticator-code" {...el('authenticator-code')} aria-live="polite" aria-atomic="true" aria-label={label(viewSettings, `${showingRolloverCode ? 'Current code after rollover' : 'Current code'} ${displayCode ?? 'unavailable'}`, `${showingRolloverCode ? '換碼後目前驗證碼' : '目前驗證碼'} ${displayCode ?? '暫時用唔到'}`)}>{displayCode ?? '—'}</div>
            {entry.nextCode && seconds !== null && seconds > 0 ? <div className="authenticator-next-code" {...el('authenticator-next-code')} aria-label={label(viewSettings, `Next code ${entry.nextCode}`, `下一個驗證碼 ${entry.nextCode}`)}><span className="supporting">{label(viewSettings, 'Next code', '下一個驗證碼')}</span><code>{entry.nextCode}</code></div> : null}
            <p className="supporting">{seconds === null ? label(viewSettings, 'Secret unavailable', '秘密暫時用唔到') : label(viewSettings, `${seconds} seconds until rollover`, `${seconds} 秒後換碼`)}</p>
            <div className="authenticator-entry-management" role="group" aria-label={label(viewSettings, `Manage ${entry.label}`, `管理 ${entry.label}`)}>
              <label>{label(viewSettings, 'Group label (optional)', '分組標籤（可選）')}<input maxLength={64} value={groupDrafts[entry.id] ?? entry.group ?? ''} onChange={(event) => setGroupDrafts((current) => ({ ...current, [entry.id]: event.target.value }))} /></label>
              <button className="text-button" type="button" onClick={() => void setEntryGroup(entry.id)}>{label(viewSettings, 'Save group', '儲存分組')}</button>
              <button className="text-button" type="button" disabled={entry.order <= 0} onClick={() => void moveEntry(entry.id, entry.order - 1)}>{label(viewSettings, 'Move up', '上移')}</button>
              <button className="text-button" type="button" disabled={entry.order >= authenticator.entries.length - 1} onClick={() => void moveEntry(entry.id, entry.order + 1)}>{label(viewSettings, 'Move down', '下移')}</button>
              <button className="text-button danger" type="button" onClick={() => setDeleteTarget(entry.id)}>{label(viewSettings, 'Delete', '刪除')}</button>
            </div>
          </article>;
        })}</div>}
      </section>
    </section>}
    {deleteTarget && <DestructiveConfirmDialog settings={viewSettings} title={label(viewSettings, 'Delete this authenticator entry?', '刪除呢個 authenticator 項目？')} description={label(viewSettings, 'This permanently deletes the selected metadata and its credential-vault ciphertext. The action is not covered by authenticator history restore in this bounded slice.', '呢個操作會永久刪除所揀 metadata 同憑證庫密文；呢個有限功能嘅 authenticator 歷史還原唔包括呢個操作。')} actionLabel={label(viewSettings, 'DELETE ENTRY', '刪除項目')} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteEntry(deleteTarget)} />}
    {bulkDeleteOpen && <DestructiveConfirmDialog settings={viewSettings} title={label(viewSettings, `Delete ${selectedVisibleIds.length} authenticator entries?`, `刪除 ${selectedVisibleIds.length} 個 authenticator 項目？`)} description={label(viewSettings, `This permanently deletes ${selectedVisibleIds.length} selected entries and their credential-vault ciphertexts. Selected labels: ${selectedVisibleIds.slice(0, 8).map((id) => visibleEntries.find((entry) => entry.id === id)?.label ?? id).join(', ')}${selectedVisibleIds.length > 8 ? '…' : ''}. Skipped or uncertain items will remain listed. Review this exact preview before authorizing.`, `呢個操作會永久刪除 ${selectedVisibleIds.length} 個揀選項目同佢哋嘅憑證庫密文。已揀標籤：${selectedVisibleIds.slice(0, 8).map((id) => visibleEntries.find((entry) => entry.id === id)?.label ?? id).join('、')}${selectedVisibleIds.length > 8 ? '…' : ''}。跳過或者未能確定嘅項目會繼續顯示。授權前請檢查呢個預覽。`)} actionLabel={label(viewSettings, `DELETE ${selectedVisibleIds.length} ENTRIES`, `刪除 ${selectedVisibleIds.length} 個項目`)} onClose={() => setBulkDeleteOpen(false)} onConfirm={() => deleteSelected()} />}
    {secretExportOpen && <DestructiveConfirmDialog settings={viewSettings} title={label(viewSettings, `Export ${selectedVisibleIds.length} authenticator secrets?`, `匯出 ${selectedVisibleIds.length} 個 authenticator 秘密？`)} description={label(viewSettings, 'This writes usable credential-vault secrets to a local file chosen in the native save dialog. Keep the file private and delete it when no longer needed. The Activity record is redacted and contains no secret bytes. Emergency exit cancels before authorization; once the native save action starts, wait for its truthful result.', '呢個操作會將可用嘅憑證庫秘密寫入原生儲存對話框揀選嘅本機檔案。請保持檔案私密，用完即刪。Activity 紀錄會遮蓋秘密內容。緊急離開會喺授權之前取消；原生儲存操作開始後，請等候真實結果。')} actionLabel={label(viewSettings, 'EXPORT SECRETS', '匯出秘密')} onClose={() => setSecretExportOpen(false)} onConfirm={() => exportSecrets()} />}
    {groupDeleteTarget && (() => {
      const group = authenticator.groups.find((item) => item.id === groupDeleteTarget);
      const memberCount = authenticator.entries.filter((entry) => entry.groupId === groupDeleteTarget).length;
      return group ? <DestructiveConfirmDialog settings={viewSettings} title={label(viewSettings, `Delete authenticator group “${group.name}”?`, `刪除 Authenticator 分組「${group.name}」？`)} description={label(viewSettings, `This deletes the group entity after both keys and the full slider are completed. ${memberCount} entries will remain and become ungrouped; their credential-vault secrets are untouched.`, `完成兩個按鍵同完整滑桿之後會刪除分組實體。${memberCount} 個項目會保留並變成未分組；憑證庫秘密唔會改動。`)} actionLabel={label(viewSettings, 'DELETE GROUP', '刪除分組')} onClose={() => setGroupDeleteTarget(null)} onConfirm={() => authenticator.deleteGroup({ groupId: group.id, confirmed: true }).then(() => undefined)} /> : null;
    })()}
  </>;
}

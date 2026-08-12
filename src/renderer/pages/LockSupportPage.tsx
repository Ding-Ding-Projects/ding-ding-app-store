import { useEffect, useMemo, useState } from 'react';
import { ELEMENTS, TOKEN_IDS } from '../../shared/contracts';
import type { LockTarget, LockUnlockDuration, SupportTicketCategory, SupportTicketSeverity, TabId, TabWorkspace, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import type { Notify } from '../notify';
import type { LocksApi } from '../state/use-locks';
import type { SupportApi } from '../state/use-support';
import { TAB_META, TOKEN_META } from '../registry';
import { SearchablePicker } from '../components/SearchablePicker';
import { DestructiveConfirmDialog } from '../components/DestructiveConfirmDialog';
import QRCode from 'qrcode';

const CATEGORY_LABELS: Record<SupportTicketCategory, { en: string; yue: string }> = {
  unlock: { en: 'Forgotten lock credential', yue: '唔記得鎖定憑證' },
  lock: { en: 'Lock setup or removal', yue: '設定或者移除鎖' },
  other: { en: 'Other local question', yue: '其他本機問題' },
};
const SEVERITY_LABELS: Record<SupportTicketSeverity, { en: string; yue: string }> = {
  low: { en: 'Low', yue: '低' },
  normal: { en: 'Normal', yue: '普通' },
  high: { en: 'High', yue: '高' },
};

function targetKey(target: LockTarget): string { return `${target.targetKind}:${target.targetId}`; }

function localTotpUri(secret: string, algorithm: string, digits: number, period: number): string {
  const params = new URLSearchParams({ secret: secret.replace(/[\s-]/g, '').toUpperCase(), algorithm: algorithm.toUpperCase(), digits: String(digits), period: String(period) });
  return `otpauth://totp/Ding%20Ding%20App%20Store%20lock?${params.toString()}`;
}

function LockTotpQr({ secret, algorithm, digits, period, settings }: { secret: string; algorithm: string; digits: number; period: number; settings: UserSettings }) {
  const [matrix, setMatrix] = useState<string[] | null>(null);
  useEffect(() => {
    let active = true;
    if (!secret || secret.length < 4 || period < 15 || period > 3600) { setMatrix(null); return () => { active = false; }; }
    try {
      const qr = QRCode.create(localTotpUri(secret, algorithm, digits, period), { errorCorrectionLevel: 'M' });
      const size = qr.modules.size;
      const next = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => qr.modules.data[row * size + column] ? '1' : '0').join(''));
      if (active) setMatrix(next);
    } catch { if (active) setMatrix(null); }
    return () => { active = false; };
  }, [algorithm, digits, period, secret]);
  if (!matrix) return null;
  return <div className="authenticator-qr-wrap"><div className="authenticator-qr" role="img" aria-label={label(settings, 'Local TOTP pairing QR code for this lock', '呢個鎖嘅本機 TOTP 配對 QR code')} style={{ gridTemplateColumns: `repeat(${matrix.length}, 1fr)` }}>{matrix.flatMap((row, rowIndex) => [...row].map((module, columnIndex) => <span aria-hidden="true" key={`${rowIndex}-${columnIndex}`} className={module === '1' ? 'authenticator-qr-module on' : 'authenticator-qr-module'} />))}</div></div>;
}

export function LockSupportPage({ settings, workspace, locks, support, notify, matcher, initialTarget }: {
  settings: UserSettings;
  workspace: TabWorkspace;
  locks: LocksApi;
  support: SupportApi;
  notify: Notify;
  matcher(haystack: string): boolean;
  initialTarget?: LockTarget | null;
}) {
  const [target, setTarget] = useState<LockTarget>({ targetKind: 'tab', targetId: workspace.tabs[0]?.id ?? 'catalog' });
  const [credential, setCredential] = useState('');
  const [currentCredential, setCurrentCredential] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [showLockSecret, setShowLockSecret] = useState(false);
  const [credentialKind, setCredentialKind] = useState<'password' | 'totp'>('password');
  const [totpAlgorithm, setTotpAlgorithm] = useState<'sha1' | 'sha256' | 'sha512'>('sha1');
  const [totpDigits, setTotpDigits] = useState<6 | 7 | 8>(6);
  const [totpPeriodSeconds, setTotpPeriodSeconds] = useState(30);
  const [unlockDuration, setUnlockDuration] = useState<LockUnlockDuration>('session');
  const [category, setCategory] = useState<SupportTicketCategory>('unlock');
  const [severity, setSeverity] = useState<SupportTicketSeverity>('normal');
  const [description, setDescription] = useState('');
  const [selectedLockKeys, setSelectedLockKeys] = useState<Set<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [bulkCredentials, setBulkCredentials] = useState<Record<string, string>>({});

  const targets = useMemo<LockTarget[]>(() => [
    ...workspace.tabs.map((tab) => ({ targetKind: 'tab' as const, targetId: tab.id })),
    ...workspace.groups.map((group) => ({ targetKind: 'group' as const, targetId: group.id })),
    ...ELEMENTS.flatMap((element) => TOKEN_IDS.filter((token) => element.tokens.includes(token)).map((token) => ({ targetKind: 'appearance-property' as const, targetId: `${element.key}:${token}` }))),
  ], [workspace.groups, workspace.tabs]);
  useEffect(() => {
    if (!initialTarget) return;
    if (targets.some((candidate) => targetKey(candidate) === targetKey(initialTarget))) {
      setTarget(initialTarget);
      setCredential('');
      setCurrentCredential('');
      setConfirmationCode('');
      setUnlockDuration(initialTarget ? (locks.state.records.find((record) => targetKey(record) === targetKey(initialTarget))?.unlockDuration ?? 'session') : 'session');
      setCredentialKind(initialTarget ? (locks.state.records.find((record) => targetKey(record) === targetKey(initialTarget))?.credentialKind ?? 'password') : 'password');
    }
  }, [initialTarget, targets, locks.state.records]);
  const targetLabel = (value: LockTarget): string => {
    if (value.targetKind === 'tab') return TAB_META[value.targetId as TabId]?.en ?? value.targetId;
    if (value.targetKind === 'appearance-property') {
      const [element, token] = value.targetId.split(':');
      return `${ELEMENTS.find((candidate) => candidate.key === element)?.en ?? element} · ${TOKEN_META[token as keyof typeof TOKEN_META]?.en ?? token}`;
    }
    return workspace.groups.find((group) => group.id === value.targetId)?.name ?? value.targetId;
  };
  const targetYue = (value: LockTarget): string => {
    if (value.targetKind === 'tab') return TAB_META[value.targetId as TabId]?.yue ?? value.targetId;
    if (value.targetKind === 'appearance-property') {
      const [element, token] = value.targetId.split(':');
      return `${ELEMENTS.find((candidate) => candidate.key === element)?.yue ?? element} · ${TOKEN_META[token as keyof typeof TOKEN_META]?.yue ?? token}`;
    }
    return workspace.groups.find((group) => group.id === value.targetId)?.name ?? value.targetId;
  };
  const visibleTargets = targets.filter((candidate) => matcher(`${targetLabel(candidate)}\n${targetYue(candidate)}\n${candidate.targetKind}\nlock`));
  const selectedRecord = locks.state.records.find((record) => targetKey(record) === targetKey(target));
  const visibleRecords = locks.state.records.filter((record) => matcher(`${targetLabel(record)}\n${targetYue(record)}\n${record.targetKind}\nlock`));
  const selectedVisibleRecords = visibleRecords.filter((record) => selectedLockKeys.has(targetKey(record)));
  const toggleLockSelection = (index: number, shiftKey = false) => { setSelectedLockKeys((current) => { const next = new Set(current); if (shiftKey && selectionAnchor !== null) { for (let cursor = Math.min(selectionAnchor, index); cursor <= Math.max(selectionAnchor, index); cursor += 1) next.add(targetKey(visibleRecords[cursor])); } else { const key = targetKey(visibleRecords[index]); if (next.has(key)) next.delete(key); else next.add(key); } return next; }); setSelectionAnchor(index); };
  const selectAllVisible = () => setSelectedLockKeys(new Set(visibleRecords.map(targetKey)));
  const invertVisible = () => setSelectedLockKeys(new Set(visibleRecords.filter((record) => !selectedLockKeys.has(targetKey(record))).map(targetKey)));
  const clearVisible = () => setSelectedLockKeys((current) => new Set([...current].filter((key) => !visibleRecords.some((record) => targetKey(record) === key))));
  const bulkLockAgain = async () => { if (selectedVisibleRecords.length) { await locks.bulkLockAgain(selectedVisibleRecords.map(({ targetKind, targetId }) => ({ targetKind, targetId }))); clearVisible(); } };
  const beginBulkRemove = () => { setBulkCredentials(Object.fromEntries(selectedVisibleRecords.map((record) => [targetKey(record), '']))); setBulkRemoveOpen(true); };
  const completeBulkRemove = async () => { await locks.bulkRemove({ confirmed: true, items: selectedVisibleRecords.map(({ targetKind, targetId }) => ({ targetKind, targetId, credential: bulkCredentials[targetKey({ targetKind, targetId })] ?? '' })) }); setBulkRemoveOpen(false); clearVisible(); };
  useEffect(() => {
    if (selectedRecord) {
      setUnlockDuration(selectedRecord.unlockDuration);
      setCredentialKind(selectedRecord.credentialKind);
      setTotpAlgorithm(selectedRecord.totpAlgorithm ?? 'sha1');
      setTotpDigits(selectedRecord.totpDigits ?? 6);
      setTotpPeriodSeconds(selectedRecord.totpPeriodSeconds ?? 30);
    }
  }, [selectedRecord?.targetKind, selectedRecord?.targetId, selectedRecord?.unlockDuration, selectedRecord?.credentialKind, selectedRecord?.totpAlgorithm, selectedRecord?.totpDigits, selectedRecord?.totpPeriodSeconds]);
  const saveLock = async () => {
    const result = await locks.set({ ...target, credentialKind, credential, totpAlgorithm: credentialKind === 'totp' ? totpAlgorithm : undefined, totpDigits: credentialKind === 'totp' ? totpDigits : undefined, totpPeriodSeconds: credentialKind === 'totp' ? totpPeriodSeconds : undefined, unlockDuration, confirmationCode: credentialKind === 'totp' ? confirmationCode : undefined, currentCredential: selectedRecord ? currentCredential : undefined });
    if (result.ok) { setCredential(''); setCurrentCredential(''); setConfirmationCode(''); }
  };
  const unlock = async () => {
    const result = await locks.unlock({ ...target, credential });
    if (result.ok) setCredential('');
  };
  const remove = async () => {
    const result = await locks.remove({ ...target, credential });
    if (result.ok) { setCredential(''); setCurrentCredential(''); }
  };
  const createTicket = async () => {
    const result = await support.create({ category, severity, description });
    if (result.ok) setDescription('');
  };
  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(support.state.recoveryPath);
      notify({ ok: true, message: 'The application-data path was copied.' });
    } catch { notify({ ok: false, message: 'The path could not be copied; select it manually.' }); }
  };

  return (
    <div className="lock-support-grid">
      <section className="settings-card" {...el('settings-card')} aria-labelledby="tab-locks-title">
        <h2 id="tab-locks-title"><Icon>lock</Icon>{label(settings, 'Tab and group locks', '分頁同分組鎖')}</h2>
        <p className="supporting">{label(settings, 'These are local UX speed bumps, not security, encryption, or protection from another person using this computer. Each lock has its own password or TOTP credential.', '呢啲係本機 UX 減速帶，唔係安全、加密，亦唔係防止其他人用呢部機。每個鎖都有自己嘅密碼或者 TOTP 憑證。')}</p>
        {!locks.state.vaultAvailable && <p className="notice warning" role="status"><Icon>warning</Icon>{label(settings, 'The operating-system credential vault is unavailable. Lock creation, unlock, and removal are disabled until the vault is available; no pretend security is offered.', '作業系統憑證庫用唔到。憑證庫恢復之前，設定、解鎖同移除都會停用；唔會扮有安全保護。')}</p>}
        <SearchablePicker id="lock-target" labelText={label(settings, 'Lock target', '鎖定目標')} settings={settings} value={targetKey(target)} onChange={(value) => {
            const next = targets.find((candidate) => targetKey(candidate) === value);
            if (next) { setTarget(next); setCredential(''); setCurrentCredential(''); }
          }} options={visibleTargets.map((candidate) => ({ value: targetKey(candidate), en: candidate.targetKind === 'tab' ? targetLabel(candidate) : `${label(settings, 'Group', '分組')} · ${targetLabel(candidate)}`, yue: candidate.targetKind === 'tab' ? targetYue(candidate) : `${label(settings, 'Group', '分組')} · ${targetYue(candidate)}` }))} />
        <SearchablePicker id="lock-credential-kind" labelText={label(settings, 'Credential method', '憑證方式')} settings={settings} value={credentialKind} onChange={(value) => setCredentialKind(value as 'password' | 'totp')} options={[{ value: 'password', en: 'Password', yue: '密碼' }, { value: 'totp', en: 'TOTP secret', yue: 'TOTP 秘密' }]} />
        {credentialKind === 'totp' && <>
          <SearchablePicker id="lock-totp-algorithm" labelText={label(settings, 'TOTP algorithm', 'TOTP 演算法')} settings={settings} value={totpAlgorithm} onChange={(value) => setTotpAlgorithm(value as typeof totpAlgorithm)} options={[{ value: 'sha1', en: 'SHA-1', yue: 'SHA-1' }, { value: 'sha256', en: 'SHA-256', yue: 'SHA-256' }, { value: 'sha512', en: 'SHA-512', yue: 'SHA-512' }]} />
          <SearchablePicker id="lock-totp-digits" labelText={label(settings, 'TOTP digits', 'TOTP 位數')} settings={settings} value={String(totpDigits)} onChange={(value) => setTotpDigits(Number(value) as 6 | 7 | 8)} options={[6, 7, 8].map((value) => ({ value: String(value), en: `${value} digits`, yue: `${value} 位` }))} />
          <label htmlFor="lock-totp-period">{label(settings, 'TOTP period in seconds (15–3600)', 'TOTP 週期秒數（15–3600）')}<input id="lock-totp-period" type="number" min={15} max={3600} step={1} value={totpPeriodSeconds} onChange={(event) => setTotpPeriodSeconds(Number(event.target.value))} /></label>
          <p className="supporting">{label(settings, 'Pairing accepts the current code plus one adjacent period for small clock drift. The secret stays in the main-process credential vault.', '配對會接受目前驗證碼同前後一個週期，容許少量時鐘偏差。秘密只留喺主程序憑證庫。')}</p>
        </>}
        <SearchablePicker id="lock-unlock-duration" labelText={label(settings, 'Unlock duration', '解鎖時限')} settings={settings} value={unlockDuration} onChange={(value) => setUnlockDuration(value as LockUnlockDuration)} options={[{ value: 'session', en: 'Until this app closes', yue: '直到呢個 app 關閉' }, { value: '15m', en: '15 minutes', yue: '15 分鐘' }, { value: '60m', en: '60 minutes', yue: '60 分鐘' }]} />
        {selectedRecord && <label htmlFor="lock-current-credential">{label(settings, credentialKind === 'totp' ? 'Current TOTP code (required to change or remove)' : 'Current password (required to change or remove)', credentialKind === 'totp' ? '目前 TOTP 驗證碼（修改或者移除時必須）' : '目前密碼（修改或者移除時必須）')}
          <input id="lock-current-credential" type="password" inputMode={credentialKind === 'totp' ? 'numeric' : undefined} autoComplete={credentialKind === 'totp' ? 'one-time-code' : 'current-password'} value={currentCredential} onChange={(event) => setCurrentCredential(event.target.value)} maxLength={512} />
        </label>}
          <label htmlFor="lock-new-credential">{label(settings, selectedRecord ? (credentialKind === 'totp' ? 'New TOTP secret' : 'New password') : (credentialKind === 'totp' ? 'TOTP secret' : 'Password'), selectedRecord ? (credentialKind === 'totp' ? '新 TOTP 秘密' : '新密碼') : (credentialKind === 'totp' ? 'TOTP 秘密' : '密碼'))}
          <input id="lock-new-credential" type="password" autoComplete={credentialKind === 'totp' ? 'off' : 'new-password'} value={credential} onChange={(event) => setCredential(event.target.value)} maxLength={512} />
          </label>
        {credentialKind === 'totp' && credential && <><button className="text-button" type="button" onClick={() => setShowLockSecret((value) => !value)}>{showLockSecret ? label(settings, 'Hide manual Base32 secret', '收埋手動 Base32 秘密') : label(settings, 'Reveal manual Base32 secret', '顯示手動 Base32 秘密')}</button>{showLockSecret && <p className="supporting"><code>{credential.replace(/[\s-]/g, '').toUpperCase()}</code></p>}<button className="text-button" type="button" onClick={() => { void navigator.clipboard.writeText(credential.replace(/[\s-]/g, '').toUpperCase()).catch(() => undefined); }}>{label(settings, 'Copy manual Base32 secret locally', '喺本機複製手動 Base32 秘密')}</button><LockTotpQr secret={credential} algorithm={totpAlgorithm} digits={totpDigits} period={totpPeriodSeconds} settings={settings} /><p className="supporting">{label(settings, 'The QR is generated locally from the entered secret and never sent through IPC. Confirm the current code before saving.', 'QR 由輸入嘅秘密喺本機產生，永遠唔會經 IPC 傳送。儲存前請確認目前驗證碼。')}</p></>}
        {credentialKind === 'totp' && <label htmlFor="lock-totp-confirmation">{label(settings, 'Current TOTP code (pairing confirmation)', '目前 TOTP 驗證碼（配對確認）')}<input id="lock-totp-confirmation" inputMode="numeric" autoComplete="one-time-code" value={confirmationCode} onChange={(event) => setConfirmationCode(event.target.value)} maxLength={8} /></label>}
        {selectedRecord && <label htmlFor="lock-new-credential">{label(settings, 'New password', '新密碼')}<input id="lock-new-credential" type="password" autoComplete="new-password" value={credential} onChange={(event) => setCredential(event.target.value)} maxLength={512} /></label>}
        <div className="settings-actions">
          <button className="filled-button" disabled={!locks.state.vaultAvailable || credential.length < 4 || Boolean(selectedRecord && !currentCredential)} onClick={() => void saveLock()}><Icon>lock</Icon>{label(settings, selectedRecord ? 'Save lock changes' : 'Set lock', selectedRecord ? '儲存鎖更改' : '設定鎖')}</button>
          {selectedRecord?.locked && <button className="filled-button" disabled={!locks.state.vaultAvailable || credential.length < 4} onClick={() => void unlock()}><Icon>lock_open</Icon>{label(settings, 'Unlock', '解鎖')}</button>}
          {selectedRecord && !selectedRecord.locked && <button className="tonal-button" onClick={() => void locks.lockAgain(target)}><Icon>lock</Icon>{label(settings, 'Lock again', '重新鎖定')}</button>}
          {selectedRecord && <button className="text-button danger" disabled={!locks.state.vaultAvailable || credential.length < 4} onClick={() => void remove()}>{label(settings, 'Remove lock', '移除鎖')}</button>}
        </div>
        <p className="supporting" role="status">{selectedRecord ? (selectedRecord.locked ? label(settings, 'This target is locked. Activation should ask for its own credential before proceeding.', '呢個目標已鎖定；啟用前應該要求自己嗰個憑證。') : selectedRecord.unlockedUntil ? label(settings, `This target is unlocked until ${new Date(selectedRecord.unlockedUntil).toLocaleTimeString()}.`, `呢個目標解鎖到 ${new Date(selectedRecord.unlockedUntil).toLocaleTimeString()}。`) : label(settings, 'This target is unlocked until this app closes.', '呢個目標解鎖直到呢個 app 關閉。')) : label(settings, 'No lock is configured for this target.', '呢個目標未設定鎖。')}</p>
        <div className="settings-actions" aria-label={label(settings, 'Bulk lock actions', '批量鎖操作')}><button className="text-button" disabled={!visibleRecords.length} onClick={selectAllVisible}>{label(settings, `Select all shown (${visibleRecords.length})`, `揀晒顯示嘅（${visibleRecords.length}）`)}</button><button className="text-button" disabled={!visibleRecords.length} onClick={invertVisible}>{label(settings, 'Invert shown selection', '反轉顯示中選擇')}</button><button className="text-button" disabled={!selectedVisibleRecords.length} onClick={clearVisible}>{label(settings, 'Clear shown selection', '清除顯示中選擇')}</button><button className="tonal-button" disabled={!selectedVisibleRecords.length} onClick={() => void bulkLockAgain()}>{label(settings, `Lock again (${selectedVisibleRecords.length})`, `重新鎖定（${selectedVisibleRecords.length}）`)}</button><button className="text-button danger" disabled={!selectedVisibleRecords.length || !locks.state.vaultAvailable} onClick={beginBulkRemove}>{label(settings, `Remove selected (${selectedVisibleRecords.length})`, `移除所選（${selectedVisibleRecords.length}）`)}</button></div>
        <p className="supporting" role="status">{label(settings, `${selectedVisibleRecords.length} selected of ${visibleRecords.length} shown. Shift-click or Shift+Arrow selects a visible range; filtered-out locks are never included.`, `顯示${visibleRecords.length} 個入面揀咗${selectedVisibleRecords.length} 個。Shift-click 或 Shift+方向鍵可以揀範圍；篩走嘅鎖唔會包括。`)}</p>
        <div className="ticket-list" role="listbox" aria-multiselectable="true" aria-label={label(settings, 'Configured locks', '已設定嘅鎖')}>
          {visibleRecords.map((record, index) => <div className="ticket-row" role="option" aria-selected={selectedLockKeys.has(targetKey(record))} tabIndex={0} key={targetKey(record)} onClick={(event) => toggleLockSelection(index, event.shiftKey)} onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggleLockSelection(index, event.shiftKey); } }}><input type="checkbox" tabIndex={-1} checked={selectedLockKeys.has(targetKey(record))} readOnly aria-label={label(settings, `Select ${targetLabel(record)}`, `揀選${targetYue(record)}`)} /><span><strong>{label(settings, targetLabel(record), targetYue(record))}</strong><small>{record.targetKind === 'tab' ? label(settings, 'Tab', '分頁') : record.targetKind === 'group' ? label(settings, 'Group', '分組') : label(settings, 'Appearance property', '外觀屬性')} · {label(settings, record.credentialKind === 'totp' ? 'TOTP' : 'Password', record.credentialKind === 'totp' ? 'TOTP' : '密碼')} · {record.locked ? label(settings, 'Locked', '已鎖定') : label(settings, 'Unlocked', '已解鎖')}</small></span><button className="text-button" onClick={(event) => { event.stopPropagation(); const next = { targetKind: record.targetKind, targetId: record.targetId } as LockTarget; setTarget(next); }}>{label(settings, 'Select', '選擇')}</button></div>)}
          {!locks.state.records.length && <p className="supporting">{label(settings, 'No locks configured yet.', '暫時未設定鎖。')}</p>}
        </div>
        <p className="supporting">{label(settings, 'Forgotten credentials are recovered only by deleting the application-data folder yourself. This is a UX reset, not a security recovery service.', '唔記得憑證只可以由你自己刪除應用程式資料夾重設。呢個係 UX 重設，唔係安全恢復服務。')}</p>
      </section>

      <section className="settings-card" {...el('settings-card')} aria-labelledby="support-tickets-title">
        <h2 id="support-tickets-title"><Icon>support_agent</Icon>{label(settings, 'Support Tickets', '支援票')}</h2>
        <p className="support-disclosure" role="note">{label(settings, support.state.disclosure, '呢度乜都唔會傳出去。支援票只會留喺呢部機，唔會發出網絡請求，唔會收集資料，亦冇人睇緊。')}</p>
        <p className="supporting">{label(settings, 'This fictional desk opens the app-data folder for you; it never deletes anything and never contacts a real support team.', '呢個虛構服務台只會幫你開應用程式資料夾；永遠唔會代你刪嘢，亦唔會聯絡真正支援團隊。')}</p>
        <SearchablePicker id="support-category" labelText={label(settings, 'Category', '類別')} settings={settings} value={category} onChange={(value) => setCategory(value as SupportTicketCategory)} options={Object.entries(CATEGORY_LABELS).map(([value, copy]) => ({ value, en: copy.en, yue: copy.yue }))} />
        <SearchablePicker id="support-severity" labelText={label(settings, 'Severity nobody will honour', '冇人會理嘅嚴重程度')} settings={settings} value={severity} onChange={(value) => setSeverity(value as SupportTicketSeverity)} options={Object.entries(SEVERITY_LABELS).map(([value, copy]) => ({ value, en: copy.en, yue: copy.yue }))} />
        <label htmlFor="support-description">{label(settings, 'Description', '描述')}<textarea id="support-description" value={description} maxLength={2_000} rows={4} onChange={(event) => setDescription(event.target.value)} placeholder={label(settings, 'Explain what happened on this device.', '講下呢部機發生咩事。')} /></label>
        <div className="settings-actions"><button className="filled-button" disabled={!description.trim()} onClick={() => void createTicket()}><Icon>confirmation_number</Icon>{label(settings, 'Create local ticket', '建立本機支援票')}</button></div>
        <div className="support-recovery" aria-label={label(settings, 'Recovery folder', '恢復資料夾')}>
          <strong>{label(settings, 'Recovery folder', '恢復資料夾')}</strong>
          <code>{support.state.recoveryPath || label(settings, 'Loading path…', '載入緊路徑…')}</code>
          <div className="settings-actions"><button className="text-button" disabled={!support.state.recoveryPath} onClick={() => void copyPath()}>{label(settings, 'Copy path', '複製路徑')}</button><button className="tonal-button" disabled={!support.state.recoveryPath} onClick={() => void support.openRecoveryFolder()}><Icon>folder_open</Icon>{label(settings, 'Open folder', '開資料夾')}</button></div>
        </div>
        <div className="ticket-list" aria-label={label(settings, 'Local ticket list', '本機支援票清單')}>
          {support.state.tickets.filter((ticket) => matcher(`${ticket.number}\n${ticket.category}\n${ticket.description}\n${ticket.status}`)).map((ticket) => <article className="ticket-row" key={ticket.id}><div><strong>{ticket.number}</strong><small>{label(settings, CATEGORY_LABELS[ticket.category].en, CATEGORY_LABELS[ticket.category].yue)} · {label(settings, SEVERITY_LABELS[ticket.severity].en, SEVERITY_LABELS[ticket.severity].yue)} · {label(settings, ticket.status, ticket.status === 'created' ? '已建立' : ticket.status === 'reviewed' ? '已閱' : '已解決')}</small><p>{ticket.description}</p><p className="supporting">{label(settings, ticket.firstResponse, '第一個回覆：服務台睇過一次說明書。乜都冇傳出去；唔記得鎖就自己刪除應用程式資料夾重設。')}</p></div><button className="text-button" disabled={ticket.status === 'resolved'} onClick={() => void support.advance(ticket.id)}>{ticket.status === 'created' ? label(settings, 'Mark reviewed', '標記已閱') : label(settings, 'Mark resolved', '標記已解決')}</button></article>)}
          {!support.state.tickets.length && <p className="supporting">{label(settings, 'No local tickets yet.', '暫時冇本機支援票。')}</p>}
        </div>
      </section>
    </div>
  );
}

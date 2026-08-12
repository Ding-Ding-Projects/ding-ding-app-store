import { useEffect, useMemo, useState } from 'react';
import { ELEMENTS, TOKEN_IDS } from '../../shared/contracts';
import type { LockTarget, SupportTicketCategory, SupportTicketSeverity, TabId, TabWorkspace, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import type { Notify } from '../notify';
import type { LocksApi } from '../state/use-locks';
import type { SupportApi } from '../state/use-support';
import { TAB_META, TOKEN_META } from '../registry';
import { SearchablePicker } from '../components/SearchablePicker';

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
  const [credentialKind, setCredentialKind] = useState<'password' | 'totp'>('password');
  const [category, setCategory] = useState<SupportTicketCategory>('unlock');
  const [severity, setSeverity] = useState<SupportTicketSeverity>('normal');
  const [description, setDescription] = useState('');

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
    }
  }, [initialTarget, targets]);
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
  const saveLock = async () => {
    const result = await locks.set({ ...target, credentialKind, credential, confirmationCode: credentialKind === 'totp' ? currentCredential : undefined, currentCredential: selectedRecord && credentialKind === 'password' ? currentCredential : undefined });
    if (result.ok) { setCredential(''); setCurrentCredential(''); }
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
        <label htmlFor="lock-current-credential">{label(settings, credentialKind === 'totp' ? 'TOTP secret or current code' : selectedRecord ? 'Current password (required to change or remove)' : 'Password', credentialKind === 'totp' ? 'TOTP 秘密或者目前驗證碼' : selectedRecord ? '目前密碼（修改或者移除時必須）' : '密碼')}
          <input id="lock-current-credential" type="password" autoComplete="current-password" value={selectedRecord ? currentCredential : credential} onChange={(event) => selectedRecord ? setCurrentCredential(event.target.value) : setCredential(event.target.value)} maxLength={512} />
        </label>
        {!selectedRecord && credentialKind === 'totp' && <label htmlFor="lock-totp-confirmation">{label(settings, 'Current TOTP code (pairing confirmation)', '目前 TOTP 驗證碼（配對確認）')}<input id="lock-totp-confirmation" inputMode="numeric" autoComplete="one-time-code" value={currentCredential} onChange={(event) => setCurrentCredential(event.target.value)} maxLength={8} /></label>}
        {selectedRecord && <label htmlFor="lock-new-credential">{label(settings, 'New password', '新密碼')}<input id="lock-new-credential" type="password" autoComplete="new-password" value={credential} onChange={(event) => setCredential(event.target.value)} maxLength={512} /></label>}
        <div className="settings-actions">
          {!selectedRecord && <button className="filled-button" disabled={!locks.state.vaultAvailable || credential.length < 4} onClick={() => void saveLock()}><Icon>lock</Icon>{label(settings, 'Set lock', '設定鎖')}</button>}
          {selectedRecord?.locked && <button className="filled-button" disabled={!locks.state.vaultAvailable || credential.length < 4} onClick={() => void unlock()}><Icon>lock_open</Icon>{label(settings, 'Unlock for this session', '今次程式工作階段解鎖')}</button>}
          {selectedRecord && !selectedRecord.locked && <button className="tonal-button" onClick={() => void locks.lockAgain(target)}><Icon>lock</Icon>{label(settings, 'Lock again', '重新鎖定')}</button>}
          {selectedRecord && <button className="text-button danger" disabled={!locks.state.vaultAvailable || credential.length < 4} onClick={() => void remove()}>{label(settings, 'Remove lock', '移除鎖')}</button>}
        </div>
        <p className="supporting" role="status">{selectedRecord ? (selectedRecord.locked ? label(settings, 'This target is locked. Activation should ask for its own password before proceeding.', '呢個目標已鎖定；啟用前應該要求自己嗰個密碼。') : label(settings, 'This target is unlocked for this app session.', '呢個目標喺今次程式工作階段已解鎖。')) : label(settings, 'No lock is configured for this target.', '呢個目標未設定鎖。')}</p>
        <div className="ticket-list" aria-label={label(settings, 'Configured locks', '已設定嘅鎖')}>
          {locks.state.records.filter((record) => matcher(`${targetLabel(record)}\n${targetYue(record)}\n${record.targetKind}\nlock`)).map((record) => <div className="ticket-row" key={targetKey(record)}><span><strong>{label(settings, targetLabel(record), targetYue(record))}</strong><small>{record.targetKind === 'tab' ? label(settings, 'Tab', '分頁') : record.targetKind === 'group' ? label(settings, 'Group', '分組') : label(settings, 'Appearance property', '外觀屬性')} · {label(settings, record.credentialKind === 'totp' ? 'TOTP' : 'Password', record.credentialKind === 'totp' ? 'TOTP' : '密碼')} · {record.locked ? label(settings, 'Locked', '已鎖定') : label(settings, 'Unlocked this session', '今次工作階段已解鎖')}</small></span><button className="text-button" onClick={() => { const next = { targetKind: record.targetKind, targetId: record.targetId } as LockTarget; setTarget(next); setCredential(''); setCurrentCredential(''); setCredentialKind(record.credentialKind); }}>{label(settings, 'Select', '選擇')}</button></div>)}
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

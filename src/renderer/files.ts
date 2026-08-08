import { MAX_IMPORT_BYTES } from '../shared/contracts';

/** Saves a string the main process produced. The renderer never names a filesystem location. */
export function downloadText(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Saves a bounded binary result returned as base64 by a typed main-process bridge. */
export function downloadBase64(filename: string, base64: string, mime: string): void {
  if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new Error('The binary export was not valid base64.');
  const binary = window.atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Reads a user-chosen document as text. Only the text crosses the bridge; the path never does,
 * and main revalidates everything before a byte is stored.
 */
export function pickTextFile(accept = 'application/json,.json'): Promise<{ ok: true; text: string } | { ok: false; message: string } | null> {
  return new Promise((resolve) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      if (file.size > MAX_IMPORT_BYTES) { resolve({ ok: false, message: `That document is larger than the ${MAX_IMPORT_BYTES.toLocaleString()} byte import limit.` }); return; }
      void file.text().then((text) => resolve({ ok: true, text }), (error: unknown) => resolve({ ok: false, message: (error as Error).message }));
    }, { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

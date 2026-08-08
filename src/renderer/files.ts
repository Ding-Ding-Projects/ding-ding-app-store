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

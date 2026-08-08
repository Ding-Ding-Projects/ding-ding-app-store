interface RegexWorkerRequest { id: number; pattern: string; flags: string; sample: string }

self.addEventListener('message', (event: MessageEvent<RegexWorkerRequest>) => {
  const { id, pattern, flags, sample } = event.data;
  try {
    const expression = new RegExp(pattern.slice(0, 160), flags.replace('g', '') + 'g');
    const matches: Array<{ text: string; groups: string[] }> = [];
    for (const match of sample.slice(0, 10_000).matchAll(expression)) {
      matches.push({ text: match[0], groups: match.slice(1) });
      if (matches.length >= 100) break;
    }
    self.postMessage({ id, error: '', matches });
  } catch (error) {
    self.postMessage({ id, error: (error as Error).message, matches: [] });
  }
});

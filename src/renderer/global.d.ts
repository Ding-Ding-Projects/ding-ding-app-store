import type { DingDingStoreApi } from '../shared/contracts';

declare global {
  interface Window {
    dingDingStore: DingDingStoreApi;
  }
}

export {};

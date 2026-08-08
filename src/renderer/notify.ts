/** One corner-notification shape for every informational and failure message in the renderer. */
export interface Notice {
  message: string;
  ok: boolean;
  undo?: { label: string; run: () => void };
}

export type Notify = (notice: Notice) => void;

import * as React from "react";
import type { DraftMessage, DraftRequest } from "../engine/draftWorker";
import type { SheetLineupSearch } from "../engine/sheetRating";

export interface DraftProgress {
  done: number;
  total: number;
  startedAt: number;
}

/**
 * One squad-draft search at a time in a Web Worker. Each run gets a fresh
 * worker, so cancelling is just terminating it; nothing leaks into the next.
 */
export function useDraftWorker() {
  const worker = React.useRef<Worker | null>(null);
  const [progress, setProgress] = React.useState<DraftProgress | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const cancel = React.useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    setProgress(null);
  }, []);
  React.useEffect(() => cancel, [cancel]);

  const run = React.useCallback(
    (req: DraftRequest, total: number, onDone: (search: SheetLineupSearch, ms: number) => void) => {
      cancel();
      setError(null);
      const w = new Worker(new URL("../engine/draftWorker.ts", import.meta.url), { type: "module" });
      worker.current = w;
      const startedAt = performance.now();
      setProgress({ done: 0, total, startedAt });
      const stop = (message?: string) => {
        w.terminate();
        if (worker.current === w) {
          worker.current = null;
          setProgress(null);
          if (message) setError(message);
        }
      };
      w.onmessage = (e: MessageEvent<DraftMessage>) => {
        const m = e.data;
        if (worker.current !== w) return;
        if (m.type === "progress") setProgress({ done: m.done, total: m.total, startedAt });
        else if (m.type === "done") {
          stop();
          onDone(m.search, m.ms);
        } else stop(`The draft failed: ${m.message}`);
      };
      w.onerror = (e) => stop(`The draft failed: ${e.message || "worker error"}`);
      w.postMessage(req);
    },
    [cancel]
  );

  return { progress, error, run, cancel };
}

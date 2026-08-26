import { MAX_HISTORY } from "./types";

export interface ActionHistory<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createActionHistory<T>(present: T): ActionHistory<T> { return { past: [], present, future: [] }; }

export function pushAction<T>(history: ActionHistory<T>, present: T): ActionHistory<T> {
  return { past: [...history.past, history.present].slice(-MAX_HISTORY), present, future: [] };
}

export function undoAction<T>(history: ActionHistory<T>): ActionHistory<T> {
  if (!history.past.length) return history;
  const past = history.past.slice(0, -1);
  const present = history.past[history.past.length - 1];
  return { past, present, future: [history.present, ...history.future].slice(0, MAX_HISTORY) };
}

export function redoAction<T>(history: ActionHistory<T>): ActionHistory<T> {
  if (!history.future.length) return history;
  const [present, ...future] = history.future;
  return { past: [...history.past, history.present].slice(-MAX_HISTORY), present, future };
}

import { createContext, useContext, useSyncExternalStore } from "react";
import type { Viewer, ViewerState } from "../viewer.ts";

export const ViewerContext = createContext<Viewer | null>(null);

export function useViewer(): Viewer {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error("useViewer must be used inside <ViewerContext>");
  return viewer;
}

/**
 * Subscribes to one slice of viewer state. The selector must return a value
 * that is stable while the state is unchanged (a field, or a primitive).
 */
export function useViewerState<T>(select: (state: ViewerState) => T): T {
  const { store } = useViewer();
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}

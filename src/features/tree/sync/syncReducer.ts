import type { TreeSyncAction, TreeSyncState } from "./types";

export const initialTreeSyncState: TreeSyncState = {
  status: "loading",
  tree: null,
  pendingOperations: [],
  conflict: null,
  replaceConfirmationRequired: false,
  error: null,
};

export function syncReducer(state: TreeSyncState, action: TreeSyncAction): TreeSyncState {
  switch (action.type) {
    case "loaded":
      return { ...state, status: action.pendingOperations?.length ? "offline" : "saved", tree: action.tree, pendingOperations: action.pendingOperations ?? [], conflict: null, replaceConfirmationRequired: false, error: null };
    case "optimistic":
      return { ...state, status: "saving", tree: action.tree, pendingOperations: state.pendingOperations.some(item => item.id === action.operation.id) ? state.pendingOperations : [...state.pendingOperations, action.operation], error: null };
    case "acknowledged":
      return { ...state, status: "saved", tree: action.tree, pendingOperations: state.pendingOperations.filter(item => item.id !== action.operationId), conflict: null, replaceConfirmationRequired: false, error: null };
    case "offline":
      return { ...state, status: "offline", pendingOperations: state.pendingOperations.some(item => item.id === action.operation.id) ? state.pendingOperations : [...state.pendingOperations, action.operation], error: null };
    case "conflict":
      return { ...state, status: "conflict", tree: action.local, conflict: { local: action.local, remote: action.remote }, replaceConfirmationRequired: false, error: null };
    case "retrying":
      return { ...state, status: "saving", error: null };
    case "public-stale":
      return { ...state, status: "public-stale" };
    case "arm-replace":
      return { ...state, replaceConfirmationRequired: true };
    case "resolved":
      return { ...state, status: "saved", tree: action.tree, pendingOperations: [], conflict: null, replaceConfirmationRequired: false, error: null };
    case "failed":
      return { ...state, error: action.message };
  }
}

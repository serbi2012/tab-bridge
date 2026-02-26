export const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined';

export const hasDocument = typeof document !== 'undefined';

export const hasLocalStorage = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
})();

export const hasBroadcastChannel = typeof BroadcastChannel !== 'undefined';

export const hasCrypto =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';

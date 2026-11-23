import { useEffect, useRef, useState, useCallback } from 'react';

export interface SyncMessage {
  type: string;
  tenancyId?: string;
  ts: number;
}

const CHANNEL_NAME = 'rentshield_live_sync';

// Global broadcast channel instance with safe fallback
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (err) {
    console.warn('BroadcastChannel initialization failed, falling back to window events', err);
  }
}

/**
 * Broadcast an event to all other tabs immediately.
 */
export const emitSyncEvent = (type: string, tenancyId?: string) => {
  const payload: SyncMessage = { type, tenancyId, ts: Date.now() };

  // 1. Send via native BroadcastChannel across tabs
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch {
      // ignore channel post error
    }
  }

  // 2. Dispatch local window custom event for same-tab listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rentshield_local_sync', { detail: payload }));
  }
};

/**
 * Hook to listen for cross-tab broadcast events AND background visibility polling.
 * Automatically triggers onSync callback without page reloads.
 */
export const useLiveSync = (onSync: () => void | Promise<void>, intervalMs = 4000) => {
  const [isLiveSynced, setIsLiveSynced] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const syncTimeoutRef = useRef<any>(null);
  const onSyncRef = useRef(onSync);

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  const triggerSync = useCallback(() => {
    try {
      const res = onSyncRef.current();
      if (res instanceof Promise) {
        res.catch(() => {});
      }
    } catch {
      // ignore fetch error in background
    }
    setLastSyncTime(Date.now());
    setIsLiveSynced(true);

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      setIsLiveSynced(false);
    }, 2800);
  }, []);

  useEffect(() => {
    // 1. Listen on BroadcastChannel for other tabs
    const handleBroadcast = (event: MessageEvent<SyncMessage>) => {
      if (event.data && typeof event.data.type === 'string') {
        triggerSync();
      }
    };

    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcast);
    }

    // 2. Listen for local events dispatched in the same window
    const handleLocalEvent = () => {
      triggerSync();
    };
    window.addEventListener('rentshield_local_sync', handleLocalEvent);

    // 3. Tab focus & visibility re-sync
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerSync();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    // 4. Background lightweight visibility-aware polling timer
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        // Silent background refresh
        try {
          const res = onSyncRef.current();
          if (res instanceof Promise) res.catch(() => {});
        } catch {
          // ignore
        }
      }
    }, intervalMs);

    return () => {
      if (broadcastChannel) {
        broadcastChannel.removeEventListener('message', handleBroadcast);
      }
      window.removeEventListener('rentshield_local_sync', handleLocalEvent);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      clearInterval(intervalId);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [triggerSync, intervalMs]);

  return { isLiveSynced, lastSyncTime };
};

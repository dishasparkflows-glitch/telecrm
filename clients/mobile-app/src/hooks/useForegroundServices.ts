import { useEffect } from 'react';
import { AppState } from 'react-native';
import { registerCallSyncTask, syncCallLog } from '@/services/callSync';
import { registerPush } from '@/services/push';
export function useForegroundServices(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    void registerPush().catch(() => undefined);
    void registerCallSyncTask().catch(() => undefined);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void syncCallLog(false).catch(() => undefined); });
    return () => subscription.remove();
  }, [enabled]);
}

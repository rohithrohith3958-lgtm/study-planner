import { useEffect, useState } from 'react';
import { syncEngine } from '../sync/syncEngine';

export function useOnlineStatus() {
  const [status, setStatus] = useState(() => ({
    isOnline: syncEngine.isOnline(),
    isRealOnline: typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true,
    isSimulatedOffline: syncEngine.getSimulationState().isSimulatedOffline,
  }));

  useEffect(() => {
    const update = () => {
      setStatus({
        isOnline: syncEngine.isOnline(),
        isRealOnline: typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true,
        isSimulatedOffline: syncEngine.getSimulationState().isSimulatedOffline,
      });
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const unsubscribe = syncEngine.subscribe(update);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      unsubscribe();
    };
  }, []);

  return status;
}

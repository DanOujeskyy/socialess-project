import { useState, useEffect, useRef } from 'react';
import { Pedometer } from 'expo-sensors';
import { useTimeStore } from '../store/time.store';

export function usePedometer() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const lastSyncedSteps = useRef(0);
  const updateSteps = useTimeStore((s) => s.updateSteps);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    Pedometer.isAvailableAsync().then((available) => {
      setIsAvailable(available);
      if (!available) return;

      const start = new Date();
      subscription = Pedometer.watchStepCount((result) => {
        setStepCount(result.steps);
        updateSteps(result.steps);
      });
    });

    return () => subscription?.remove();
  }, []);

  return { isAvailable, stepCount };
}

import { useState, useEffect, useRef } from 'react';
import { Pedometer } from 'expo-sensors';
import { useTimeStore } from '../store/time.store';
import { activitiesService } from '../services/activities.service';

const STEPS_SYNC_INTERVAL = 500; // sync every 500 new steps

export function usePedometer() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const lastSyncedSteps = useRef(0);
  const { updateSteps, addTime } = useTimeStore();

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    Pedometer.isAvailableAsync().then((available) => {
      setIsAvailable(available);
      if (!available) return;

      subscription = Pedometer.watchStepCount(async (result) => {
        const steps = result.steps;
        setStepCount(steps);
        updateSteps(steps);

        // Sync to server every STEPS_SYNC_INTERVAL new steps
        if (steps - lastSyncedSteps.current >= STEPS_SYNC_INTERVAL) {
          try {
            const res = await activitiesService.recordSteps(steps);
            addTime(res.secondsAdded);
            lastSyncedSteps.current = steps;
          } catch {
            // Will retry on next interval
          }
        }
      });
    });

    return () => subscription?.remove();
  }, []);

  return { isAvailable, stepCount };
}

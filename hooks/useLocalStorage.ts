import { useState, useEffect, useCallback, useRef } from 'react';

// Use a custom event type that carries detail
const LOCAL_STORAGE_EVENT = 'local-storage-update';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Use a ref to ensure stable access to the initial value in callbacks
  const initialValueRef = useRef(initialValue);

  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initialValueRef.current;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValueRef.current;
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return initialValueRef.current;
    }
  }, [key]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Dispatch custom event for in-tab sync
  const dispatchStorageEvent = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_EVENT, { detail: { key } }));
    }
  }, [key]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((current) => {
        const valueToStore = value instanceof Function ? value(current) : value;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          dispatchStorageEvent();
        }
        return valueToStore;
      });
    } catch (error) {
      console.warn(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, dispatchStorageEvent]);

  const removeValue = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
        setStoredValue(initialValueRef.current);
        dispatchStorageEvent();
      }
    } catch (error) {
      console.warn(`Error removing localStorage key “${key}”:`, error);
    }
  }, [key, dispatchStorageEvent]);

  // Sync logic
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent | CustomEvent) => {
      // Handle native 'storage' event (cross-tab)
      if (event instanceof StorageEvent && event.key === key) {
        setStoredValue(readValue());
      }
      // Handle custom event (same-tab)
      else if (event instanceof CustomEvent && event.type === LOCAL_STORAGE_EVENT && (event as any).detail.key === key) {
        setStoredValue(readValue());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(LOCAL_STORAGE_EVENT, handleStorageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(LOCAL_STORAGE_EVENT, handleStorageChange as EventListener);
    };
  }, [key, readValue]);

  return [storedValue, setValue, removeValue] as const;
}

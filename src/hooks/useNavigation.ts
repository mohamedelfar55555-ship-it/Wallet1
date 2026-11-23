import { useCallback, useEffect, useState } from 'react';
import { AppRoute, MainTab, RouteEntry } from '../types/navigation';

const INITIAL_ENTRY: RouteEntry = { route: 'home' };

export function getActiveTabForRoute(route: AppRoute): MainTab {
  switch (route) {
    case 'home':
      return 'home';
    case 'offers':
      return 'offers';
    case 'internet':
      return 'internet';
    case 'wallet':
    case 'wallet-history':
    case 'wallet-tx-detail':
    case 'import-data':
      return 'wallet';
    case 'admin-login':
    case 'admin':
    case 'more':
      return 'more';
  }
}

export function useNavigation() {
  const [stack, setStack] = useState<RouteEntry[]>([INITIAL_ENTRY]);

  const currentEntry = stack[stack.length - 1] ?? INITIAL_ENTRY;
  const canGoBack = stack.length > 1;
  const activeTab = getActiveTabForRoute(currentEntry.route);

  const pushEntry = useCallback((entry: RouteEntry) => {
    setStack((prev) => {
      const top = prev[prev.length - 1];
      if (
        top &&
        top.route === entry.route &&
        top.transactionId === entry.transactionId
      ) {
        return prev;
      }
      const next = [...prev, entry];
      try {
        window.history.pushState({ navDepth: next.length, entry }, '');
      } catch {
        // Ignore history push errors in restricted environments
      }
      return next;
    });
  }, []);

  const navigateTo = useCallback(
    (route: AppRoute, transactionId?: string) => {
      pushEntry({ route, transactionId });
    },
    [pushEntry]
  );

  const switchTab = useCallback(
    (tab: MainTab) => {
      if (tab === 'home') {
        setStack([INITIAL_ENTRY]);
        return;
      }
      pushEntry({ route: tab });
    },
    [pushEntry]
  );

  const goBack = useCallback(() => {
    setStack((prev) => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setStack((prev) => {
        if (prev.length <= 1) return prev;
        return prev.slice(0, -1);
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentEntry.route, currentEntry.transactionId]);

  return {
    currentRoute: currentEntry.route,
    selectedTransactionId: currentEntry.transactionId ?? null,
    activeTab,
    canGoBack,
    stack,
    navigateTo,
    switchTab,
    goBack,
  };
}

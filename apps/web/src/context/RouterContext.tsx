import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type NavigateOptions = { replace?: boolean };
type RouterContextValue = {
  path: string;
  navigate(to: string, options?: NavigateOptions): void;
};

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const value = useMemo<RouterContextValue>(
    () => ({
      path,
      navigate(to, options = {}) {
        if (window.location.pathname === to) return;
        if (options.replace) window.history.replaceState({}, '', to);
        else window.history.pushState({}, '', to);
        setPath(to);
      },
    }),
    [path],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useRouter must be used inside RouterProvider');
  return context;
}

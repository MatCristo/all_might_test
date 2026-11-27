import { Outlet, useLocation } from 'react-router-dom'
import { ToastContext, DarkModeContext, MeContext } from './context/context'
import type { Me } from './context/context'
import { useState, useRef, useEffect, useCallback } from 'react'
import ToastCustom from './components/toastCustom/toastCustom';
import { fetchMe } from './handlers/handlers';

function Layout() {
  const [variant, setVariant] = useState<string>('success');
  const [title, setTitle] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(isDark));
  }, [isDark]);

  const toggleDark = () => setIsDark(prev => !prev);

  /* The session's pages, loaded once and re-read after each login: the sidebar
     asks this instead of a cookie, so it shows what the API will actually
     answer. A 401 here just means "nobody is logged in" — the pages send the
     user to /login on their own. */
  const [me, setMe] = useState<Me | null>(null);
  const [isLoadingMe, setIsLoadingMe] = useState<boolean>(true);
  const { pathname } = useLocation();

  const loadMe = useCallback(async () => {
    setIsLoadingMe(true);

    try {
      const response = await fetchMe();
      setMe(response.success ? (response.data as Me) : null);
    } catch {
      setMe(null);
    } finally {
      setIsLoadingMe(false);
    }
  }, []);

  /* Reloading on the way out of /login is what picks up the new session. The
     flag rather than the path keeps this to one fetch per sign-in instead of
     one per navigation. */
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!isLoginPage) loadMe();
  }, [isLoginPage, loadMe]);

  /* A session the caller already holds. Login has one the moment its request
     answers, and handing it over here is what makes the next render see it. */
  const setSession = useCallback((session: Me) => {
    setMe(session);
    setIsLoadingMe(false);
  }, []);

  const clearMe = useCallback(() => {
    setMe(null);
    setIsLoadingMe(false);
  }, []);

  const can = useCallback(
    (permission: string) => me?.permissions.includes(permission) ?? false,
    [me],
  );

  const showToast = (title: string, message: string, variant: string = "primary") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setIsVisible(false);
    setVariant(variant);
    setTitle(title);
    setMessage(message);
    setIsVisible(true);

    toastTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 10000);
  };

  const closeToast = () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setIsVisible(false)
  };

  const toastContextValue = {
    variant,
    title,
    showToast,
    isVisible,
    message,
    closeToast
  };

  return (
  <DarkModeContext.Provider value={{ isDark, toggleDark }}>
    <MeContext.Provider value={{ me, isLoading: isLoadingMe, can, reload: loadMe, set: setSession, clear: clearMe }}>
      <ToastContext.Provider value={toastContextValue}>
        <ToastCustom/>
        <main>
          <Outlet />
        </main>
      </ToastContext.Provider>
    </MeContext.Provider>
  </DarkModeContext.Provider>
  )
}

export default Layout
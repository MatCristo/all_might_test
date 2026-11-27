import { createContext } from 'react';

type ToastContextType = {
    variant: string;
    title: string;
    message: string;
    isVisible: boolean;
    showToast: (title: string, message: string, variant?: string) => void;
    closeToast: () => void;
};

export const ToastContext = createContext<ToastContextType>({
  variant: "",
  title: "",
  message: "",
  isVisible: false,
  showToast: () => {},
  closeToast: () => {}
});

type DarkModeContextType = {
  isDark: boolean;
  toggleDark: () => void;
};

export const DarkModeContext = createContext<DarkModeContextType>({
  isDark: false,
  toggleDark: () => {},
});

/* Who is logged in and which pages they hold, loaded once from GET /api/me.

   The menu used to read a `user_role` cookie the browser wrote for itself,
   which stopped being able to describe anything once permissions became
   per-user: two support users may now see different things. This is still only
   cosmetics — the API refuses on its own — but it is cosmetics the server
   decides. */
export type Me = {
  id: string;
  name: string;
  // The role the user was created under. A label; it grants nothing.
  role: string;
  permissions: string[];
};

type MeContextType = {
  me: Me | null;
  isLoading: boolean;
  can: (permission: string) => boolean;
  reload: () => Promise<void>;
  /* Hands the context a session that is already known — the login page has one
     in the answer it just read. Without it the first render after signing in
     still sees the null left by the load that ran before anyone was logged in,
     and the page guard redirects to /login before the reload can finish. */
  set: (session: Me) => void;
  // Forgets the session on the way out, so the menu of whoever just signed out
  // never survives into the next render.
  clear: () => void;
};

export const MeContext = createContext<MeContextType>({
  me: null,
  isLoading: true,
  can: () => false,
  reload: async () => {},
  set: () => {},
  clear: () => {},
});

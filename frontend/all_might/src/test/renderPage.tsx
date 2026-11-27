/* Every page of the panel is rendered inside the same three things: a router,
   the session, and the toast bus. Building them by hand in fifteen test files
   is fifteen chances to build them slightly differently, so they are built
   once here.

   The router is a real one with a /login route in it: a page that answers 401
   by calling navigate('/login') can then be checked by what the screen shows,
   rather than by asserting on a mocked function nobody ever renders. */
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { DarkModeContext, MeContext, ToastContext } from '../context/context';
import type { Me } from '../context/context';
import { PANEL_PAGES } from '../navigation/pages';

// What the screen says once a page has given up and sent someone to sign in.
export const LOGIN_SCREEN = 'tela de login';

/* Holds every page, because these tests are about what a screen does and not
   about who may open it — the guard has its own suite for that. */
export const admin: Me = {
    id: '11111111-1111-4111-8111-000000000001',
    name: 'teste admin',
    role: 'admin',
    permissions: PANEL_PAGES.map(page => page.permission),
};

type Options = {
    // The address the page is opened at, query string included: several screens
    // read their filters from it.
    route?: string;
    me?: Me | null;
    /* Renders against the browser's own history instead of an in-memory one.
       A page that reads window.location — or that writes the URL with
       setSearchParams and then reacts to window.location.search — only works
       as it does in the browser when the two are the same object. */
    history?: boolean;
};

export function renderPage(element: ReactElement, { route = '/', me = admin, history = false }: Options = {}) {
    const showToast = vi.fn();
    const clear = vi.fn();

    if (history) window.history.pushState({}, '', route);

    const Router = ({ children }: { children: ReactElement }) => history
        ? <BrowserRouter>{children}</BrowserRouter>
        : <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>;

    const view = render(
        <Router>
            <DarkModeContext.Provider value={{ isDark: false, toggleDark: () => {} }}>
                <MeContext.Provider
                    value={{
                        me,
                        isLoading: false,
                        can: permission => me?.permissions.includes(permission) ?? false,
                        reload: async () => {},
                        set: () => {},
                        clear,
                    }}
                >
                    <ToastContext.Provider
                        value={{
                            variant: '',
                            title: '',
                            message: '',
                            isVisible: false,
                            showToast,
                            closeToast: () => {},
                        }}
                    >
                        <Routes>
                            <Route path="/login" element={<p>{LOGIN_SCREEN}</p>} />
                            <Route path="*" element={element} />
                        </Routes>
                    </ToastContext.Provider>
                </MeContext.Provider>
            </DarkModeContext.Provider>
        </Router>,
    );

    return { ...view, showToast, clear };
}

// The two shapes every handler in the panel answers with.
export const ok = (data: unknown, status = 200) => ({ success: true, status, data });
export const fail = (status: number, data: unknown = null) => ({ success: false, status, data });

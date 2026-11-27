import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PageGuard from './pageGuard';
import { MeContext } from '../../context/context';
import type { Me } from '../../context/context';

const support: Me = {
    id: '11111111-1111-4111-8111-000000000002',
    name: 'teste support',
    role: 'support',
    permissions: ['page:integracao'],
};

function renderGuard(permission: string, value: { me: Me | null; isLoading: boolean }) {
    return render(
        <MemoryRouter initialEntries={['/']}>
            <MeContext.Provider
                value={{
                    ...value,
                    can: page => value.me?.permissions.includes(page) ?? false,
                    reload: async () => {},
                    set: () => {},
                    clear: () => {},
                }}
            >
                <Routes>
                    <Route
                        path="/"
                        element={<PageGuard permission={permission}><p>a página</p></PageGuard>}
                    />
                    <Route path="/login" element={<p>tela de login</p>} />
                </Routes>
            </MeContext.Provider>
        </MemoryRouter>,
    );
}

describe('PageGuard', () => {
    afterEach(() => {
        cleanup();
    });

    it('shows the page to someone who holds it', () => {
        renderGuard('page:integracao', { me: support, isLoading: false });

        expect(screen.getByText('a página')).toBeTruthy();
    });

    /* The layout re-reads the session on every navigation. Blanking the screen
       for a check on a session we already hold would flash a spinner over a
       page that is perfectly usable. */
    it('keeps the page up while a session it already holds is revalidated', () => {
        renderGuard('page:integracao', { me: support, isLoading: true });

        expect(screen.getByText('a página')).toBeTruthy();
        expect(screen.queryByText('tela de login')).toBeNull();
    });

    it('waits rather than deciding before the first answer arrives', () => {
        renderGuard('page:integracao', { me: null, isLoading: true });

        expect(screen.queryByText('tela de login')).toBeNull();
        expect(screen.queryByText('a página')).toBeNull();
    });

    it('sends someone with no session at all to the login screen', () => {
        renderGuard('page:integracao', { me: null, isLoading: false });

        expect(screen.getByText('tela de login')).toBeTruthy();
    });

    it('explains the refusal instead of redirecting when the page is not theirs', () => {
        renderGuard('page:outra', { me: support, isLoading: false });

        expect(screen.getByText(/Sem acesso a esta página/i)).toBeTruthy();
        expect(screen.queryByText('tela de login')).toBeNull();
    });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { MeContext } from '../../context/context';
import type { Me } from '../../context/context';

/*
Signing in used to take two attempts.

The layout re-reads GET /api/me on the way out of this page, but that answer
only lands after the next page has already rendered — and it renders against
the null left behind by the /api/me that ran before anyone was logged in. The
page guard sees no session, sends the person back to /login, and only the
second attempt sticks, because by then the first attempt's reload has arrived.

Nothing was wrong with the cookie. What was missing is this: the login answer
already carries the session, and handing it to the context before navigating is
what makes the very first render after signing in see it.
*/

const session = {
    id: '11111111-1111-4111-8111-000000000003',
    name: 'teste support',
    role: 'support',
    permissions: ['page:integracao'],
    message: 'Login successful',
};

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return { ...actual, useNavigate: () => navigate };
});

function renderLogin(set: (session: Me) => void) {
    return render(
        <MemoryRouter>
            <MeContext.Provider
                value={{ me: null, isLoading: false, can: () => false, reload: async () => {}, set, clear: () => {} }}
            >
                <Login />
            </MeContext.Provider>
        </MemoryRouter>,
    );
}

async function signIn(password = 'teste1234') {
    const user = userEvent.setup();
    const [email, secret] = screen.getAllByRole('textbox').length > 1
        ? screen.getAllByRole('textbox')
        : [screen.getAllByRole('textbox')[0], document.querySelector('input[type="password"]')!];

    await user.type(email, 'teste.support@telelaudo.com.br');
    await user.type(secret as HTMLElement, password);
    await user.click(screen.getByRole('button', { name: /entrar|login|acessar/i }));
}

describe('Login', () => {
    beforeEach(() => {
        navigate.mockClear();
    });

    afterEach(() => {
        cleanup();
    });

    it('hands the session to the context before navigating', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(session), { status: 200 })));

        const order: string[] = [];
        const set = vi.fn(() => { order.push('set'); });
        navigate.mockImplementation(() => { order.push('navigate'); });

        renderLogin(set);
        await signIn();

        await waitFor(() => expect(set).toHaveBeenCalled());

        expect(set).toHaveBeenCalledWith(expect.objectContaining({
            name: 'teste support',
            permissions: session.permissions,
        }));
        expect(order).toEqual(['set', 'navigate']);
    });

    it('lands on the first page the session actually holds', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(session), { status: 200 })));

        renderLogin(vi.fn());
        await signIn();

        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    });

    it('says so and stays put when the password is wrong', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })));

        const set = vi.fn();
        renderLogin(set);
        await signIn('errada');

        await waitFor(() => expect(screen.getByText(/incorretos/i)).toBeTruthy());
        expect(set).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('does not seed a session from an answer that carries no pages', async () => {
        // An older backend, mid-deploy: better no session than a broken one.
        vi.stubGlobal('fetch', vi.fn(async () =>
            new Response(JSON.stringify({ message: 'Login successful', role: 'support' }), { status: 200 })));

        const set = vi.fn();
        renderLogin(set);
        await signIn();

        await waitFor(() => expect(navigate).toHaveBeenCalled());
        expect(set).not.toHaveBeenCalled();
    });
});

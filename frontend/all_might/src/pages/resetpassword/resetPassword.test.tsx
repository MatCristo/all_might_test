import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPassword from './resetPassword';
import { renderPage } from '../../test/renderPage';

/* The three rules this form enforces before it ever reaches the API — filled
   in, long enough, and the same twice — are the ones a person hits daily, and
   each of them has to fail loudly rather than post a password the backend will
   refuse for a reason the screen cannot explain. */
async function fill(current: string, next: string, confirmation: string) {
    const user = userEvent.setup();
    const [currentField, nextField, confirmField] = screen.getAllByDisplayValue('');

    if (current) await user.type(currentField, current);
    if (next) await user.type(nextField, next);
    if (confirmation) await user.type(confirmField, confirmation);

    await user.click(screen.getByRole('button', { name: /alterar senha/i }));
}

describe('Alterar senha', () => {
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    /* The three fields are `required`, so the browser stops a half-filled form
       before submit ever fires: nothing is sent, and the handler's own "Preencha
       todos os campos" toast is a second line of defence that never speaks. What
       matters here is that no password leaves the page. */
    it('does not post a half-filled form', async () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);

        renderPage(<ResetPassword />);
        await fill('teste1234', '', '');

        expect(fetch).not.toHaveBeenCalled();
    });

    it('refuses a new password shorter than eight characters', async () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);

        const { showToast } = renderPage(<ResetPassword />);
        await fill('teste1234', 'curta', 'curta');

        expect(showToast).toHaveBeenCalledWith('Erro', 'A nova senha deve ter pelo menos 8 caracteres', 'danger');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('refuses a confirmation that does not match', async () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);

        const { showToast } = renderPage(<ResetPassword />);
        await fill('teste1234', 'senhanova1', 'senhanova2');

        expect(showToast).toHaveBeenCalledWith('Erro', 'Nova senha e confirmação não conferem', 'danger');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('sends the change and empties the form once it is done', async () => {
        const fetch = vi.fn(async () => new Response(JSON.stringify({ message: 'Senha alterada' }), { status: 200 }));
        vi.stubGlobal('fetch', fetch);

        const { showToast } = renderPage(<ResetPassword />);
        await fill('teste1234', 'senhanova1', 'senhanova1');

        await waitFor(() => expect(showToast).toHaveBeenCalledWith('Sucesso', 'Senha alterada', 'success'));

        const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toContain('/user/change_password');
        expect(JSON.parse(String(init.body))).toEqual({
            password: 'teste1234',
            newPassword: 'senhanova1',
            confirmPassword: 'senhanova1',
        });

        /* Leaving the old password sitting in the form is what lets the next
           person at a shared workstation read it. */
        await waitFor(() => expect(screen.getAllByDisplayValue('')).toHaveLength(3));
    });

    it('shows the reason the API gave for refusing', async () => {
        vi.stubGlobal('fetch', vi.fn(async () =>
            new Response(JSON.stringify({ message: 'Senha atual incorreta' }), { status: 400 })));

        const { showToast } = renderPage(<ResetPassword />);
        await fill('errada12', 'senhanova1', 'senhanova1');

        await waitFor(() => expect(showToast).toHaveBeenCalledWith('Erro', 'Senha atual incorreta', 'danger'));
    });

    /* A gateway's HTML error page has no message to show, and is not a broken
       connection either: the form's own wording, not "Erro na comunicação". */
    it('falls back to its own wording when the refusal is not JSON', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 })));

        const { showToast } = renderPage(<ResetPassword />);
        await fill('teste1234', 'senhanova1', 'senhanova1');

        await waitFor(() => expect(showToast).toHaveBeenCalledWith('Erro', 'Erro ao alterar a senha', 'danger'));
    });

    it('sends the session cookie with the change', async () => {
        const fetch = vi.fn(async () => new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
        vi.stubGlobal('fetch', fetch);

        renderPage(<ResetPassword />);
        await fill('teste1234', 'senhanova1', 'senhanova1');

        await waitFor(() => expect(fetch).toHaveBeenCalled());
        const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
        expect(init.credentials).toBe('include');
    });
});

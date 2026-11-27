import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from './Home';
import {
    LOGS_PAGE_SIZE, fetchCompanies, fetchReportDeliveryLogs, resendReport,
} from './handlers/handlers';
import { renderPage, ok, fail, LOGIN_SCREEN } from '../../test/renderPage';

vi.mock('./handlers/handlers', async importOriginal => ({
    ...await importOriginal<typeof import('./handlers/handlers')>(),
    fetchReportDeliveryLogs: vi.fn(),
    fetchCompanies: vi.fn(),
    resendReport: vi.fn(),
}));

const logs = vi.mocked(fetchReportDeliveryLogs);
const companies = vi.mocked(fetchCompanies);
const resend = vi.mocked(resendReport);

const log = (id: number) => ({
    id,
    company_name: 'Clinica Sao Jose',
    service_desc: 'Envio de laudo',
    cd_atendimento: 9000 + id,
    http_status_code: 200,
    http_response: `{"ok":${id}}`,
    origin_server: 'srv-01',
    created_at: '2026-09-15T12:00:00Z',
    report_selector_value: '',
});

const open = () => renderPage(<Home />, { route: '/' });

const ready = async () => {
    await waitFor(() => expect(logs).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Carregando logs')).toBeNull());
};

describe('Integração', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    /* The empresa filter loads on mount on every test; only the logs differ
       from one to the next. */
    beforeEach(() => {
        companies.mockResolvedValue(ok([{ id: 7, name: 'Clinica Sao Jose' }]) as never);
    });

    it('lists the delivery logs, in the clinic\'s own clock', async () => {
        logs.mockResolvedValue(ok([log(1)]) as never);

        open();
        await ready();

        expect(screen.getByText('Envio de laudo')).toBeTruthy();
        expect(screen.getByText('9001')).toBeTruthy();
        // The timestamps are BRT wall-clock stored as UTC: noon stays noon.
        expect(screen.getByText('15/09/2026, 12:00:00')).toBeTruthy();
    });

    it('opens the HTTP answer the row only shows a status code for', async () => {
        logs.mockResolvedValue(ok([log(1)]) as never);

        open();
        await ready();

        await userEvent.setup().click(screen.getByRole('button', { name: '200' }));

        const modal = await screen.findByRole('dialog');
        expect(within(modal).getByText('{"ok":1}')).toBeTruthy();
    });

    /* Both filters are applied together and always from the first page: page 3
       of the old result set says nothing about the new one. */
    it('searches by attendance code and company, from the first page', async () => {
        logs.mockResolvedValue(ok(Array.from({ length: LOGS_PAGE_SIZE }, (_, i) => log(i + 1))) as never);

        open();
        await ready();

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: /Next/ }));
        await waitFor(() => expect(logs).toHaveBeenLastCalledWith(1, '', ''));

        await user.type(screen.getByLabelText('Buscar por código de atendimento'), '9001');
        await user.click(screen.getByRole('button', { name: 'Buscar' }));

        await waitFor(() => expect(logs).toHaveBeenLastCalledWith(0, '9001', ''));
    });

    it('offers a way out of the filters, and takes it back to everything', async () => {
        logs.mockResolvedValue(ok([log(1)]) as never);

        open();
        await ready();

        const user = userEvent.setup();
        expect(screen.queryByRole('button', { name: 'Limpar' })).toBeNull();

        // An empty result under a filter reads differently from an empty table.
        logs.mockResolvedValue(ok([]) as never);
        await user.type(screen.getByLabelText('Buscar por código de atendimento'), '9001');
        await user.click(screen.getByRole('button', { name: 'Buscar' }));

        await waitFor(() => expect(screen.getByText('Nenhum log corresponde aos filtros.')).toBeTruthy());
        expect(screen.getByRole('button', { name: 'Limpar' })).toBeTruthy();

        logs.mockResolvedValue(ok([log(1)]) as never);
        await user.click(screen.getByRole('button', { name: 'Limpar' }));

        await waitFor(() => expect(logs).toHaveBeenLastCalledWith(0, '', ''));
    });

    /* The endpoint answers with a bare array and no total, so a page that came
       back full is the only evidence that another one exists. */
    it('stops offering a next page once one comes back short', async () => {
        logs.mockResolvedValue(ok([log(1)]) as never);

        open();
        await ready();

        // A disabled pager control is rendered as plain text, not as a button.
        expect(screen.queryByRole('button', { name: /Next/ })).toBeNull();
        expect(screen.getByText('Next').closest('li')!.className).toContain('disabled');
        expect(screen.getByText(/Exibindo 1 log · página 1/)).toBeTruthy();
    });

    it('confirms a resend before making it, and reports what came back', async () => {
        logs.mockResolvedValue(ok([log(1)]) as never);
        resend.mockResolvedValue(ok({ message: 'Reenvio realizado' }) as never);

        open();
        await ready();

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Reenviar' }));

        const modal = await screen.findByRole('dialog');
        expect(within(modal).getByText(/Deseja reenviar o exame/)).toBeTruthy();
        expect(resend).not.toHaveBeenCalled();

        await user.click(within(modal).getByRole('button', { name: 'Reenviar' }));

        await waitFor(() => expect(resend).toHaveBeenCalledWith(9001));
        expect(await screen.findByText('Reenvio realizado')).toBeTruthy();
    });

    it('sends an expired session to the login screen', async () => {
        logs.mockResolvedValue(fail(401) as never);

        open();

        await waitFor(() => expect(screen.getByText(LOGIN_SCREEN)).toBeTruthy());
    });

    it('says why the logs are missing instead of spinning', async () => {
        logs.mockResolvedValue(fail(500, { message: 'boom' }) as never);

        const { showToast } = open();

        await waitFor(() => expect(showToast).toHaveBeenCalledWith('Erro', 'Erro obtendo os logs: boom', 'danger'));
        expect(screen.queryByText('Carregando logs')).toBeNull();
    });
});

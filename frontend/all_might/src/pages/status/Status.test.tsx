import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Status from './Status';
import { fetchApplicationsStatus } from './handlers/handlers';
import type { ApplicationStatus, ApplicationStatusReport } from './handlers/handlers';
import { formatMoment, formatRange } from './format';
import { renderPage, ok, fail, LOGIN_SCREEN } from '../../test/renderPage';

vi.mock('./handlers/handlers', async importOriginal => ({
    ...await importOriginal<typeof import('./handlers/handlers')>(),
    fetchApplicationsStatus: vi.fn(),
}));

const fetchStatus = vi.mocked(fetchApplicationsStatus);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* The report is built around the real clock, so the page's "is this report
   stale?" check sees a fresh one. */
const now = new Date(Math.floor(Date.now() / (5 * MINUTE)) * 5 * MINUTE);
const at = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString();
const windowStart = at(7 * DAY);

const healthy = (name: string): ApplicationStatus => ({
    name,
    status: 'ok',
    since: windowStart,
    last_data_at: at(5 * MINUTE),
    failed_periods: 0,
    segments: [{ status: 'ok', start: windowStart, end: at(0) }],
});

const failing: ApplicationStatus = {
    name: 'storelts',
    status: 'failing',
    since: at(3 * HOUR),
    last_data_at: at(5 * MINUTE),
    failed_periods: 36,
    segments: [
        { status: 'ok', start: windowStart, end: at(3 * HOUR) },
        { status: 'failing', start: at(3 * HOUR), end: at(0) },
    ],
};

const silent: ApplicationStatus = {
    name: 'critical-notifier',
    status: 'no_data',
    since: at(HOUR),
    last_data_at: at(HOUR + 5 * MINUTE),
    failed_periods: 0,
    segments: [
        { status: 'ok', start: windowStart, end: at(HOUR) },
        { status: 'no_data', start: at(HOUR), end: at(0) },
    ],
};

const report = (applications: ApplicationStatus[], generatedAt = at(0)): ApplicationStatusReport => ({
    generated_at: generatedAt,
    window_start: windowStart,
    period_seconds: 300,
    applications,
});

const open = () => renderPage(<Status />, { route: '/status' });

const ready = async () => {
    await waitFor(() => expect(fetchStatus).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Carregando status das aplicações')).toBeNull());
};

describe('Status das aplicações', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('says plainly when every application is fine', async () => {
        fetchStatus.mockResolvedValue(ok(report([healthy('Clean-zip'), healthy('clinuxsend')])) as never);

        open();
        await ready();

        expect(screen.getByText('Todas as 2 aplicações estão executando no prazo.')).toBeTruthy();
        expect(screen.getAllByText('OK em todo o período (7 d)')).toHaveLength(2);
    });

    /* The question the page exists for: is anything wrong now, since when? */
    it('names the problems and since when, before the list', async () => {
        fetchStatus.mockResolvedValue(ok(report([failing, silent, healthy('Clean-zip')])) as never);

        open();
        await ready();

        const banner = screen.getByText('2 aplicações com problema').closest('[role="status"]') as HTMLElement;
        expect(within(banner).getByText('storelts')).toBeTruthy();
        expect(banner.textContent).toContain(`falhando desde ${formatMoment(failing.since)} · há 3 h`);
        expect(banner.textContent).toContain(`sem dados desde ${formatMoment(silent.since)} · há 1 h`);
        expect(banner.textContent).not.toContain('Clean-zip');
    });

    it('keeps the order the API gives: problems first', async () => {
        fetchStatus.mockResolvedValue(ok(report([failing, silent, healthy('Clean-zip')])) as never);

        open();
        await ready();

        const names = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
        expect(names).toEqual(['storelts', 'critical-notifier', 'Clean-zip']);
    });

    it('shows when a silent application last reported, and how often one failed', async () => {
        fetchStatus.mockResolvedValue(ok(report([failing, silent])) as never);

        open();
        await ready();

        expect(screen.getByText(`Último dado: ${formatMoment(silent.last_data_at!)}`)).toBeTruthy();
        expect(screen.getByText('36 execuções fora do prazo no período')).toBeTruthy();
    });

    it('warns when the report itself is old', async () => {
        fetchStatus.mockResolvedValue(ok(report([healthy('Clean-zip')], at(40 * MINUTE))) as never);

        open();
        await ready();

        expect(screen.getByRole('alert').textContent).toContain('não confie no verde');
    });

    it('sends an expired session to the login screen', async () => {
        fetchStatus.mockResolvedValue(fail(401) as never);

        open();

        expect(await screen.findByText(LOGIN_SCREEN)).toBeTruthy();
    });

    it('offers to try again when the report cannot be read', async () => {
        fetchStatus.mockResolvedValue(fail(500, { message: 'boom' }) as never);

        const { showToast } = open();
        await ready();

        expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
        expect(showToast).toHaveBeenCalledWith('Erro', 'Erro obtendo o status das aplicações: boom', 'danger');
    });

    /* The timeline answers "what was happening at this moment?" under the
       pointer. jsdom lays nothing out, so the bar is given a width by hand. */
    it('tells the moment and the state under the pointer', async () => {
        fetchStatus.mockResolvedValue(ok(report([failing])) as never);

        open();
        await ready();

        const bar = screen.getByRole('img', { name: /Linha do tempo de storelts/ });
        vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 1000 } as DOMRect);

        /* jsdom has no PointerEvent, so the pointer is moved with a mouse event
           of the same name: it carries clientX, which is all the bar reads. */
        const pointer = (type: string, init: MouseEventInit) =>
            act(() => { bar.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init })); });

        /* The last thousandth of a week is just over 10 minutes ago, inside the
           failure; the tooltip names the 5-minute period it falls in, which
           began 15 minutes ago. */
        pointer('pointermove', { clientX: 999 });

        const tooltip = await screen.findByRole('tooltip');
        expect(tooltip.textContent).toContain(formatMoment(at(15 * MINUTE)));
        expect(tooltip.textContent).toContain('Falhando');
        expect(tooltip.textContent).toContain(`${formatMoment(failing.since)} – agora (3 h)`);

        // React reads "the pointer left" from pointerout towards outside the bar.
        pointer('pointerout', { relatedTarget: document.body });
        expect(screen.queryByRole('tooltip')).toBeNull();
    });

    /* The same answer in words, for whoever is not using a mouse. */
    it('lists past problems newest first, and the rest on request', async () => {
        const flapping: ApplicationStatus = {
            ...healthy('notify-hearp'),
            failed_periods: 4,
            segments: [4, 3, 2, 1].flatMap(day => [
                { status: 'ok' as const, start: at(day * DAY + HOUR), end: at(day * DAY) },
                { status: 'failing' as const, start: at(day * DAY), end: at(day * DAY - 5 * MINUTE) },
            ]),
        };

        fetchStatus.mockResolvedValue(ok(report([flapping])) as never);

        open();
        await ready();

        const row = screen.getByRole('heading', { name: 'notify-hearp' }).closest('article') as HTMLElement;
        const items = () => within(row).getAllByRole('listitem').map(li => li.textContent);
        expect(items()).toEqual([1, 2, 3].map(day =>
            `Falhando ${formatRange(at(DAY * day), at(DAY * day - 5 * MINUTE))} (5 min)`));

        await userEvent.setup().click(screen.getByRole('button', { name: 'ver todas (4)' }));
        expect(items()).toHaveLength(4);
    });
});

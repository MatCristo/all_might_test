import { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import clsx from 'clsx';
import styles from './Status.module.css';
import SidebarCustom from '../../components/sidebar/sidebarCustom';
import Spinner from '../../components/spinner/spinner';
import { ToastContext } from '../../context/context';
import { fetchApplicationsStatus } from './handlers/handlers';
import type { ApplicationStatus, ApplicationStatusReport, AppState } from './handlers/handlers';
import { durationBetween, formatDuration, formatMoment, formatTime } from './format';

/* The backend rebuilds the report every 5 minutes; asking every minute keeps
   the screen at most a minute behind without anyone pressing anything. */
const REFRESH_MS = 60 * 1000;

/* The report describes "now" to the 5-minute period. Much older than that and
   the screen is no longer telling the truth about now, which an on-call person
   has to know before trusting a row of green. */
const STALE_AFTER_MS = 15 * 60 * 1000;

const STATE_LABEL: Record<AppState, string> = {
    failing: 'Falhando',
    no_data: 'Sem dados',
    ok: 'OK',
};

/* Each row answers "is it fine, and since when", in words. */
function describeSince(app: ApplicationStatus, report: ApplicationStatusReport): string {
    const ago = formatDuration(durationBetween(app.since, report.generated_at));

    if (app.since === report.window_start) {
        const window = formatDuration(durationBetween(report.window_start, report.generated_at));
        return app.status === 'ok'
            ? `OK em todo o período (${window})`
            : `${STATE_LABEL[app.status]} há pelo menos ${window}`;
    }

    return `${STATE_LABEL[app.status]} desde ${formatMoment(app.since)} · há ${ago}`;
}

function Timeline({ app, report }: { app: ApplicationStatus; report: ApplicationStatusReport }) {
    const start = new Date(report.window_start).getTime();
    const total = new Date(report.generated_at).getTime() - start;

    const failures = app.segments.filter(s => s.status === 'failing').length;
    const gaps = app.segments.filter(s => s.status === 'no_data').length;

    /* Fine stretches are drawn first, so a 5-minute failure — a sliver over a
       week — is drawn over them instead of under. */
    const ordered = [...app.segments].sort((a, b) => Number(a.status !== 'ok') - Number(b.status !== 'ok'));

    return (
        <div
            className={styles.timeline}
            role="img"
            aria-label={`Linha do tempo de ${app.name}: ${failures} trecho(s) com falha, ${gaps} trecho(s) sem dados`}
        >
            {ordered.map(segment => {
                const left = ((new Date(segment.start).getTime() - start) / total) * 100;
                const width = ((new Date(segment.end).getTime() - new Date(segment.start).getTime()) / total) * 100;

                return (
                    <span
                        key={segment.start}
                        className={clsx(styles.segment, styles[`segment_${segment.status}`])}
                        /* A minimum width keeps a single bad period visible. */
                        style={{ left: `${left}%`, width: `max(3px, ${width}%)` }}
                        title={`${STATE_LABEL[segment.status]} · ${formatMoment(segment.start)} – ${formatMoment(segment.end)}`}
                    />
                );
            })}
        </div>
    );
}

function Status() {
    const [report, setReport] = useState<ApplicationStatusReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const toastContext = useContext(ToastContext);
    const navigate = useNavigate();

    const load = useCallback(async () => {
        setIsLoading(true);

        try {
            const { success, status, data } = await fetchApplicationsStatus();

            if (status === 401) {
                navigate('/login');
                return;
            }

            if (!success || !data) {
                setLoadFailed(true);
                const message = status === 403
                    ? 'Usuário sem permissão'
                    : `Erro obtendo o status das aplicações: ${(data as { message?: string } | null)?.message || 'Erro desconhecido'}`;
                toastContext.showToast('Erro', message, 'danger');
                return;
            }

            setReport(data);
            setLoadFailed(false);
        } catch (error) {
            setLoadFailed(true);
            toastContext.showToast('Erro', 'Erro obtendo o status das aplicações: ' + (error || 'Erro desconhecido'), 'danger');
        } finally {
            setIsLoading(false);
        }
    }, [navigate, toastContext]);

    useEffect(() => {
        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => clearInterval(timer);
    }, [load]);

    const problems = report?.applications.filter(app => app.status !== 'ok') ?? [];
    const count = (state: AppState) => report?.applications.filter(app => app.status === state).length ?? 0;
    const isStale = report !== null && Date.now() - new Date(report.generated_at).getTime() > STALE_AFTER_MS;

    return (
        <div className={styles.appContainer}>
            <SidebarCustom />
            <div className={styles.contentContainer}>
                <header className={styles.header}>
                    <div>
                        <h1 className={styles.pageTitle}>Status das aplicações</h1>
                        <p className={styles.subtitle}>
                            Execução no prazo das aplicações de background (ExecucaoNoPrazo, máximo a cada 5 min)
                            {report && <> · dados até <strong>{formatTime(report.generated_at)}</strong></>}
                        </p>
                    </div>
                    <Button variant="outline-secondary" onClick={load} disabled={isLoading}>
                        {isLoading && report ? <Spinner size={16} label="Atualizando" /> : 'Atualizar'}
                    </Button>
                </header>

                {!report && isLoading && (
                    <div className={styles.center}>
                        <Spinner label="Carregando status das aplicações" />
                    </div>
                )}

                {!report && !isLoading && loadFailed && (
                    <div className={styles.center}>
                        <p className={styles.muted}>Não foi possível carregar o status das aplicações.</p>
                        <Button variant="primary" onClick={load}>Tentar novamente</Button>
                    </div>
                )}

                {report && (
                    <>
                        {isStale && (
                            <div className={clsx(styles.banner, styles.banner_warn)} role="alert">
                                Os dados param em {formatMoment(report.generated_at)}. A leitura da métrica pode estar
                                atrasada — não confie no verde até ela voltar.
                            </div>
                        )}

                        {/* The question the page exists for, answered before anything else. */}
                        {problems.length === 0 ? (
                            <div className={clsx(styles.banner, styles.banner_ok)} role="status">
                                Todas as {report.applications.length} aplicações estão executando no prazo.
                            </div>
                        ) : (
                            <div className={clsx(styles.banner, styles.banner_danger)} role="status">
                                <strong>
                                    {problems.length === 1
                                        ? '1 aplicação com problema'
                                        : `${problems.length} aplicações com problema`}
                                </strong>
                                <ul className={styles.problemList}>
                                    {problems.map(app => (
                                        <li key={app.name}>
                                            <strong>{app.name}</strong>: {describeSince(app, report).toLowerCase()}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <p className={styles.counts}>
                            <span className={styles.count_failing}>{count('failing')} falhando</span>
                            <span className={styles.count_no_data}>{count('no_data')} sem dados</span>
                            <span className={styles.count_ok}>{count('ok')} OK</span>
                        </p>

                        {report.applications.length === 0 ? (
                            <p className={styles.muted}>Nenhuma aplicação publicou a métrica nos últimos 7 dias.</p>
                        ) : (
                            <section className={styles.list} aria-label="Aplicações">
                                <div className={styles.axis} aria-hidden>
                                    <span>{formatMoment(report.window_start)}</span>
                                    <span>agora ({formatTime(report.generated_at)})</span>
                                </div>

                                {report.applications.map(app => (
                                    <article key={app.name} className={clsx(styles.row, styles[`row_${app.status}`])}>
                                        <span className={clsx(styles.badge, styles[`badge_${app.status}`])}>
                                            {STATE_LABEL[app.status]}
                                        </span>
                                        <div className={styles.info}>
                                            <h2 className={styles.appName}>{app.name}</h2>
                                            <p className={styles.since}>{describeSince(app, report)}</p>
                                            {app.status === 'no_data' && app.last_data_at && (
                                                <p className={styles.detail}>Último dado: {formatMoment(app.last_data_at)}</p>
                                            )}
                                            {app.failed_periods > 0 && (
                                                <p className={styles.detail}>
                                                    {app.failed_periods} {app.failed_periods === 1 ? 'execução fora do prazo' : 'execuções fora do prazo'} no período
                                                </p>
                                            )}
                                        </div>
                                        <Timeline app={app} report={report} />
                                    </article>
                                ))}

                                <div className={styles.legend} aria-hidden>
                                    <span><i className={clsx(styles.swatch, styles.segment_ok)} /> OK</span>
                                    <span><i className={clsx(styles.swatch, styles.segment_failing)} /> Falhando</span>
                                    <span><i className={clsx(styles.swatch, styles.segment_no_data)} /> Sem dados</span>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default Status;

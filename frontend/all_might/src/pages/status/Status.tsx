import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import type { PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import clsx from 'clsx';
import styles from './Status.module.css';
import SidebarCustom from '../../components/sidebar/sidebarCustom';
import Spinner from '../../components/spinner/spinner';
import { ToastContext } from '../../context/context';
import { fetchApplicationsStatus } from './handlers/handlers';
import type { ApplicationStatus, ApplicationStatusReport, AppState, StatusSegment } from './handlers/handlers';
import {
    durationBetween, formatDayLabel, formatDuration, formatMoment, formatRange, formatTime, midnightsBetween,
} from './format';

/* The backend rebuilds the report every 5 minutes; asking every minute keeps
   the screen at most a minute behind without anyone pressing anything. */
const REFRESH_MS = 60 * 1000;

/* The report describes "now" to the 5-minute period. Much older than that and
   the screen is no longer telling the truth about now, which an on-call person
   has to know before trusting a row of green. */
const STALE_AFTER_MS = 15 * 60 * 1000;

const DAY = 24 * 60 * 60 * 1000;

/* How many past problems a row lists before offering to show the rest. */
const INCIDENTS_SHOWN = 3;

const STATE_LABEL: Record<AppState, string> = {
    failing: 'Falhando',
    no_data: 'Sem dados',
    ok: 'OK',
};

/* Each row answers "is it fine, and since when", in words. */
function describeSince(app: ApplicationStatus, report: ApplicationStatusReport): string {
    const ago = formatDuration(durationBetween(app.since, report.generated_at));

    if (app.since === report.window_start) {
        const length = formatDuration(durationBetween(report.window_start, report.generated_at));
        return app.status === 'ok'
            ? `OK em todo o período (${length})`
            : `${STATE_LABEL[app.status]} há pelo menos ${length}`;
    }

    return `${STATE_LABEL[app.status]} desde ${formatMoment(app.since)} · há ${ago}`;
}

/* "25/11, 03:00 – 15:00 (12 h)", or "– agora" for the one still going on. */
function describeSegment(segment: StatusSegment, report: ApplicationStatusReport): string {
    const duration = formatDuration(durationBetween(segment.start, segment.end));

    return segment.end === report.generated_at
        ? `${formatMoment(segment.start)} – agora (${duration})`
        : `${formatRange(segment.start, segment.end)} (${duration})`;
}

type TimeWindow = { start: number; total: number; midnights: number[] };

/* Where an instant sits on the timeline, in percent of its width. */
const position = (iso: string | number, timeWindow: TimeWindow) =>
    ((new Date(iso).getTime() - timeWindow.start) / timeWindow.total) * 100;

function Timeline({ app, report, timeWindow }: { app: ApplicationStatus; report: ApplicationStatusReport; timeWindow: TimeWindow }) {
    /* Where the pointer is, as a fraction of the width. */
    const [hover, setHover] = useState<number | null>(null);

    const failures = app.segments.filter(s => s.status === 'failing').length;
    const gaps = app.segments.filter(s => s.status === 'no_data').length;

    /* Fine stretches are drawn first, so a 5-minute failure — a sliver over a
       week — is drawn over them instead of under. */
    const ordered = [...app.segments].sort((a, b) => Number(a.status !== 'ok') - Number(b.status !== 'ok'));

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const fraction = (event.clientX - box.left) / box.width;
        if (!Number.isFinite(fraction)) return; // no layout yet, or no pointer position
        setHover(Math.min(1, Math.max(0, fraction)));
    };

    /* What the pointer is over: the 5-minute period it falls in, and the
       stretch that period belongs to. */
    let tooltip = null;

    if (hover !== null) {
        const period = report.period_seconds * 1000;
        const instant = timeWindow.start + hover * timeWindow.total;
        const periodStart = Math.min(Math.floor(instant / period) * period, timeWindow.start + timeWindow.total - period);
        const segment = app.segments.find(s =>
            new Date(s.start).getTime() <= periodStart && periodStart < new Date(s.end).getTime());

        tooltip = (
            <div
                className={styles.tooltip}
                role="tooltip"
                style={{
                    left: `${hover * 100}%`,
                    // Kept inside the row at both ends.
                    transform: `translateX(${hover < 0.2 ? '0' : hover > 0.8 ? '-100%' : '-50%'})`,
                }}
            >
                <strong>{formatMoment(new Date(periodStart).toISOString())}</strong>
                {segment ? (
                    <>
                        <span className={styles[`tooltip_${segment.status}`]}>{STATE_LABEL[segment.status]}</span>
                        <span className={styles.tooltipDetail}>{describeSegment(segment, report)}</span>
                    </>
                ) : (
                    <span className={styles.tooltipDetail}>Aguardando o dado deste período</span>
                )}
            </div>
        );
    }

    return (
        <div className={styles.timelineWrap}>
            <div
                className={styles.timeline}
                onPointerMove={onPointerMove}
                onPointerLeave={() => setHover(null)}
                role="img"
                aria-label={`Linha do tempo de ${app.name}: ${failures} trecho(s) com falha, ${gaps} trecho(s) sem dados`}
            >
                {ordered.map(segment => (
                    <span
                        key={segment.start}
                        className={clsx(styles.segment, styles[`segment_${segment.status}`])}
                        style={{
                            left: `${position(segment.start, timeWindow)}%`,
                            /* A minimum width keeps a single bad period visible. */
                            width: `max(3px, ${position(segment.end, timeWindow) - position(segment.start, timeWindow)}%)`,
                        }}
                    />
                ))}
                {timeWindow.midnights.map(midnight => (
                    <span key={midnight} className={styles.dayLine} style={{ left: `${position(midnight, timeWindow)}%` }} />
                ))}
                {hover !== null && <span className={styles.cursor} style={{ left: `${hover * 100}%` }} />}
            </div>
            {tooltip}
        </div>
    );
}

function ApplicationRow({ app, report, timeWindow }: { app: ApplicationStatus; report: ApplicationStatusReport; timeWindow: TimeWindow }) {
    const [showAll, setShowAll] = useState(false);

    /* Every stretch that was not fine, newest first: the same answer the
       timeline gives on hover, readable without a mouse. */
    const incidents = app.segments.filter(s => s.status !== 'ok').reverse();
    const shown = showAll ? incidents : incidents.slice(0, INCIDENTS_SHOWN);

    return (
        <article className={clsx(styles.row, styles[`row_${app.status}`])}>
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
            <Timeline app={app} report={report} timeWindow={timeWindow} />

            {incidents.length > 0 && (
                <div className={styles.incidents}>
                    <span className={styles.incidentsTitle}>Ocorrências:</span>
                    <ul className={styles.incidentList}>
                        {shown.map(segment => (
                            <li key={segment.start}>
                                <span className={styles[`tooltip_${segment.status}`]}>{STATE_LABEL[segment.status]}</span>
                                {' '}{describeSegment(segment, report)}
                            </li>
                        ))}
                    </ul>
                    {incidents.length > INCIDENTS_SHOWN && (
                        <button type="button" className={styles.linkButton} onClick={() => setShowAll(!showAll)}>
                            {showAll ? 'mostrar menos' : `ver todas (${incidents.length})`}
                        </button>
                    )}
                </div>
            )}
        </article>
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

    /* The time span every timeline shares, and where its days begin. */
    const timeWindow = useMemo<TimeWindow | null>(() => report && {
        start: new Date(report.window_start).getTime(),
        total: durationBetween(report.window_start, report.generated_at),
        midnights: midnightsBetween(report.window_start, report.generated_at),
    }, [report]);

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

                {report && timeWindow && (
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
                                {/* Each date in the middle of its own day, over the timelines'
                                    column. A day cut short at either end of the window is only
                                    labelled when at least half of it is there. */}
                                <div className={styles.axis} aria-hidden>
                                    {[timeWindow.start, ...timeWindow.midnights].map((dayStart, i, starts) => {
                                        const dayEnd = starts[i + 1] ?? timeWindow.start + timeWindow.total;

                                        return dayEnd - dayStart >= DAY / 2 && (
                                            <span
                                                key={dayStart}
                                                className={styles.axisDay}
                                                style={{ left: `${position((dayStart + dayEnd) / 2, timeWindow)}%` }}
                                            >
                                                {formatDayLabel(dayStart)}
                                            </span>
                                        );
                                    })}
                                </div>

                                {report.applications.map(app => (
                                    <ApplicationRow key={app.name} app={app} report={report} timeWindow={timeWindow} />
                                ))}

                                <div className={styles.legend} aria-hidden>
                                    <span>Passe o mouse no gráfico para ver o horário</span>
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

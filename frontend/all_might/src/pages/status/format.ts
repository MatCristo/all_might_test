/* Time on this page is real UTC from CloudWatch, shown in the team's own
   clock. (The Integração logs are different: BRT stored as UTC.) */
const TIME_ZONE = 'America/Sao_Paulo';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "27/11 14:05" — the date matters, the year and the seconds do not. */
export const formatMoment = (iso: string): string =>
    new Date(iso).toLocaleString('pt-BR', {
        timeZone: TIME_ZONE,
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

/** "14:05" */
export const formatTime = (iso: string): string =>
    new Date(iso).toLocaleTimeString('pt-BR', {
        timeZone: TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

/** A duration in the largest two units that matter: "45 min", "2 h 55 min", "3 d 4 h". */
export const formatDuration = (milliseconds: number): string => {
    const ms = Math.max(0, milliseconds);

    if (ms < HOUR) {
        return `${Math.round(ms / MINUTE)} min`;
    }

    if (ms < DAY) {
        const hours = Math.floor(ms / HOUR);
        const minutes = Math.round((ms % HOUR) / MINUTE);
        return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
    }

    const days = Math.floor(ms / DAY);
    const hours = Math.round((ms % DAY) / HOUR);
    return hours ? `${days} d ${hours} h` : `${days} d`;
};

/** How long ago `iso` was, measured against the report's own "now". */
export const durationBetween = (fromIso: string, toIso: string): number =>
    new Date(toIso).getTime() - new Date(fromIso).getTime();

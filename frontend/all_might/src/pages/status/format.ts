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

/** "25/11" */
const formatDay = (ms: number): string =>
    new Date(ms).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit' });

/** "25/11, 03:00 – 15:00" on one day, "25/11, 22:00 – 26/11, 01:00" across two. */
export const formatRange = (startIso: string, endIso: string): string => {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();

    return formatDay(start) === formatDay(end)
        ? `${formatMoment(startIso)} – ${formatTime(endIso)}`
        : `${formatMoment(startIso)} – ${formatMoment(endIso)}`;
};

/* How far São Paulo's wall clock is from UTC at a given instant (in ms). Read
   from the browser's time zone data rather than hardcoded to -3h, so it stays
   right if daylight saving ever comes back. */
const offsetAt = (ms: number): number => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE,
        hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms));

    const part = (type: string) => Number(parts.find(p => p.type === type)?.value);

    const wallClock = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));

    return wallClock - Math.floor(ms / 1000) * 1000;
};

/** Every São Paulo midnight strictly between start and end, as UTC milliseconds
    — where the timeline draws its day lines. */
export const midnightsBetween = (startIso: string, endIso: string): number[] => {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const midnights: number[] = [];

    // The first midnight after start, on the wall clock...
    let wallMidnight = Math.floor((start + offsetAt(start)) / DAY) * DAY + DAY;

    for (;;) {
        // ...turned back into a real instant.
        const instant = wallMidnight - offsetAt(wallMidnight);

        if (instant >= end) break;
        if (instant > start) midnights.push(instant);

        wallMidnight += DAY;
    }

    return midnights;
};

/** "25/11" for a midnight, as the axis labels it. */
export const formatDayLabel = (ms: number): string => formatDay(ms);

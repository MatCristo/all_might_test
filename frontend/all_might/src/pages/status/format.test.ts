import { describe, it, expect } from 'vitest';
import { formatDuration, formatMoment, formatRange, formatTime, midnightsBetween } from './format';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatDuration', () => {
    it('uses minutes under an hour', () => {
        expect(formatDuration(45 * MINUTE)).toBe('45 min');
    });

    it('uses hours and minutes under a day', () => {
        expect(formatDuration(2 * HOUR + 55 * MINUTE)).toBe('2 h 55 min');
        expect(formatDuration(3 * HOUR)).toBe('3 h');
    });

    it('uses days and hours beyond that', () => {
        expect(formatDuration(7 * DAY)).toBe('7 d');
        expect(formatDuration(2 * DAY + 4 * HOUR)).toBe('2 d 4 h');
    });

    it('never goes negative', () => {
        expect(formatDuration(-5 * MINUTE)).toBe('0 min');
    });
});

describe('formatMoment / formatTime', () => {
    // CloudWatch answers in real UTC; the team reads São Paulo time.
    it('shows UTC in São Paulo time', () => {
        expect(formatMoment('2026-11-27T15:00:00Z')).toBe('27/11, 12:00');
        expect(formatTime('2026-11-27T15:00:00Z')).toBe('12:00');
    });
});

describe('formatRange', () => {
    it('writes the date once when the stretch fits in one day', () => {
        expect(formatRange('2026-11-25T06:00:00Z', '2026-11-25T18:00:00Z')).toBe('25/11, 03:00 – 15:00');
    });

    it('writes both dates when it crosses midnight', () => {
        expect(formatRange('2026-11-25T23:00:00Z', '2026-11-26T05:00:00Z')).toBe('25/11, 20:00 – 26/11, 02:00');
    });
});

describe('midnightsBetween', () => {
    // São Paulo is UTC-3: its midnight is 03:00 UTC.
    it('lists every São Paulo midnight inside the window', () => {
        const midnights = midnightsBetween('2026-11-20T18:25:00Z', '2026-11-27T18:25:00Z');

        expect(midnights.map(ms => new Date(ms).toISOString())).toEqual([
            '2026-11-21T03:00:00.000Z',
            '2026-11-22T03:00:00.000Z',
            '2026-11-23T03:00:00.000Z',
            '2026-11-24T03:00:00.000Z',
            '2026-11-25T03:00:00.000Z',
            '2026-11-26T03:00:00.000Z',
            '2026-11-27T03:00:00.000Z',
        ]);
    });

    it('leaves out a midnight that is exactly an end of the window', () => {
        expect(midnightsBetween('2026-11-21T03:00:00Z', '2026-11-22T03:00:00Z')).toEqual([]);
    });
});

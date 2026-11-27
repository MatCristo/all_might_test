import { describe, it, expect } from 'vitest';
import { formatDuration, formatMoment, formatTime } from './format';

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

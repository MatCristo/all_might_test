import { describe, it, expect } from 'vitest';
import { PANEL_PAGES, landingPathFor } from './pages';

/* Where someone lands after signing in. */
describe('landingPathFor', () => {
    it('sends whoever holds Integração to "/"', () => {
        expect(landingPathFor(['page:integracao'])).toBe('/');
    });

    it('sends whoever holds only Status das aplicações to "/status"', () => {
        expect(landingPathFor(['page:status'])).toBe('/status');
    });

    it('falls back to "/" when there is nothing to land on', () => {
        // The guard on "/" explains the situation; a blank screen would not.
        expect(landingPathFor([])).toBe('/');
        expect(landingPathFor(undefined)).toBe('/');
        expect(landingPathFor(['page:inexistente'])).toBe('/');
    });

    it('can land on every page the rail lists', () => {
        for (const page of PANEL_PAGES) {
            expect(landingPathFor([page.permission])).toBe(page.path);
        }
    });
});

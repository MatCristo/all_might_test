/* The pages of the panel, in sidebar order, each with the permission the API
   demands of the routes behind it.

   It lives outside the sidebar because two screens need it: the rail renders
   it, and the login page reads it to decide where to land someone. */
export type PanelPage = {
    path: string;
    label: string;
    permission: string;
};

export const PANEL_PAGES: PanelPage[] = [
    { path: '/', label: 'Integração', permission: 'page:integracao' },
];

/* Where someone lands after signing in: the first page they actually hold, in
   the order the rail lists them. Somebody with no pages at all still goes to "/", where the guard
   explains the situation instead of a blank screen. */
export const landingPathFor = (permissions: string[] | undefined): string =>
    PANEL_PAGES.find(page => permissions?.includes(page.permission))?.path ?? '/';

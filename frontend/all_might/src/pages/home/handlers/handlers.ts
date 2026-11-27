import type { RequisitionResponse } from "../../../handlers/types";
import { request } from "../../../handlers/request";

const apiUrl = import.meta.env.VITE_API_URL;

/* The backend returns this many delivery logs per page. There is no total in
   the response, so this constant is what lets the page tell "a full page" from
   "the last page" — keep it in step with `limit` in reportstore. */
export const LOGS_PAGE_SIZE = 20;

/**
 * One page (0-based) of report delivery logs, optionally narrowed by
 * attendance code and/or company. Both filters are applied by the backend —
 * filtering here would only ever narrow the 20 rows of the current page.
 */
export const fetchReportDeliveryLogs = async (
    page: number,
    cdAtendimento?: string,
    companyId?: string
): Promise<RequisitionResponse> => {
    const params = new URLSearchParams({ page: String(page) });

    if (cdAtendimento && cdAtendimento.trim() !== '') {
        params.append('cd_atendimento', cdAtendimento.trim());
    }

    if (companyId && companyId.trim() !== '') {
        params.append('company_id', companyId.trim());
    }

    return request(`${apiUrl}/report/logs?${params.toString()}`);
};

/** Clinux companies, for the empresa filter. Returns [{ id, name }]. */
export const fetchCompanies = async (): Promise<RequisitionResponse> =>
    request(`${apiUrl}/company/clinux`);

export const resendReport = async (reportCode: number): Promise<RequisitionResponse> =>
    request(`${apiUrl}/report/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_code: reportCode }),
    });

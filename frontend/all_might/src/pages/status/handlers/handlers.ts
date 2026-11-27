import type { RequisitionResponse } from "../../../handlers/types";
import { request } from "../../../handlers/request";

const apiUrl = import.meta.env.VITE_API_URL;

export type AppState = 'ok' | 'failing' | 'no_data';

/** A stretch of time in one state, from start (inclusive) to end (exclusive). */
export type StatusSegment = {
    status: AppState;
    start: string;
    end: string;
};

/** One background application, as GET /api/status/applications describes it. */
export type ApplicationStatus = {
    name: string;
    status: AppState;
    /** When the current state began; equal to window_start when it lasted the whole window. */
    since: string;
    last_data_at: string | null;
    failed_periods: number;
    segments: StatusSegment[];
};

export type ApplicationStatusReport = {
    /** The moment the report describes ("now", aligned to the 5-minute period). */
    generated_at: string;
    window_start: string;
    period_seconds: number;
    /** Already ordered: failing, then no data, then fine. */
    applications: ApplicationStatus[];
};

export const fetchApplicationsStatus = async (): Promise<RequisitionResponse<ApplicationStatusReport>> =>
    request<ApplicationStatusReport>(`${apiUrl}/status/applications`);

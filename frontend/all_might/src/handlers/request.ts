import type { RequisitionResponse } from "./types";

/**
 * Every call the panel makes to its API: the session cookie rides along
 * (`credentials: 'include'`), and the answer comes back as success, status and
 * the parsed body — null when there is none, or it is not JSON.
 */
export const request = async <T = RequisitionResponse['data']>(
    url: string,
    init: RequestInit = {},
): Promise<RequisitionResponse<T>> => {
    const response = await fetch(url, { credentials: 'include', ...init });

    return {
        success: response.ok,
        status: response.status,
        data: await response.json().catch(() => null),
    };
};

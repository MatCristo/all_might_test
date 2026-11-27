import type { RequisitionResponse } from "./types";
import { request } from "./request";

const apiUrl = import.meta.env.VITE_API_URL;

/* Who the API thinks is calling, and which pages they may open. The sidebar
   and the permissions screen both start here. */
export const fetchMe = async (): Promise<RequisitionResponse> => {
    return request(`${apiUrl}/me`);
};

/* Ends the session. The cookie is HttpOnly, so only the server can clear it —
   without this call "Sair" left a live session behind for the next person to
   walk into by pressing Back. */
export const logout = async (): Promise<RequisitionResponse> => {
    return request(`${apiUrl}/logout`, {
        method: 'POST',
    });
};

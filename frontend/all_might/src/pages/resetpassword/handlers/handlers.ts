import type { RequisitionResponse } from "../../../handlers/types";
import { request } from "../../../handlers/request";

const apiUrl = import.meta.env.VITE_API_URL;

export const changePassword = async (
    password: string,
    newPassword: string,
    confirmPassword: string,
): Promise<RequisitionResponse> => {
    return request(`${apiUrl}/user/change_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, newPassword, confirmPassword }),
    });
};

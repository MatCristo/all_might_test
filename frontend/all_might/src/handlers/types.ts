
export interface RequisitionResponse<T = any> {
  success: boolean;
  status: number;
  data: T | null;
}
package models

import "time"

type LogReportDeliveryDTO struct {
	ID                  int       `json:"id"`
	DsEmpresa           string    `json:"company_name,omitempty"`
	ServiceDesc         string    `json:"service_desc,omitempty"`
	Event               string    `json:"event,omitempty"`
	CdAtendimento       int       `json:"cd_atendimento,omitempty"`
	HTTPStatusCode      int       `json:"http_status_code,omitempty"`
	HTTPResponse        string    `json:"http_response,omitempty"`
	OriginServer        string    `json:"origin_server,omitempty"`
	CreatedAt           time.Time `json:"created_at,omitempty"`
	ReportSelectorValue string    `json:"report_selector_value,omitempty"`
}

type RequestQueryData struct {
	Page          int
	CdAtendimento *string
	CompanyId     *string
}

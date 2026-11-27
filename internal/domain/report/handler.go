package report

import (
	"net/http"

	"github.com/DaviTelelaudo/all-might/internal/domain/report/reportstore"
	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
	"github.com/labstack/echo/v4"
)

func ResendReport(c echo.Context) error {

	type ReportCode struct {
		ReportCode int `json:"report_code"`
	}

	var reportCode ReportCode

	err := c.Bind(&reportCode)
	if err != nil {
		return c.JSON(http.StatusBadRequest, models.MessageDTO{Message: "bad request, must have report_code in the json"})
	}

	if reportCode.ReportCode == 0 {
		return c.JSON(http.StatusBadRequest, models.MessageDTO{Message: "bad request, must have report_code in the json"})
	}

	err = reportstore.ResendReport(reportCode.ReportCode)

	if err != nil {
		return c.JSON(http.StatusNotFound, models.MessageDTO{Message: err.Error()})
	}

	return c.JSON(http.StatusOK, models.MessageDTO{Message: "Marked for resend successfully"})
}

func GetLogsReportDelivery(c echo.Context) error {

	type RequestData struct {
		Page          *int    `query:"page"`
		CdAtendimento *string `query:"cd_atendimento"`
		CompanyId     *string `query:"company_id"`
	}

	var requestData RequestData

	err := c.Bind(&requestData)

	if err != nil {
		return c.JSON(http.StatusBadRequest, models.MessageDTO{Message: "bad request, must have page and cd_atendimento in the query"})
	}

	if requestData.Page == nil {
		defaultPage := 0
		requestData.Page = &defaultPage
	}

	// An empty query param binds to a pointer to "", which would reach Postgres
	// as ''::int and error. Treat blank as "no filter".
	if requestData.CdAtendimento != nil && *requestData.CdAtendimento == "" {
		requestData.CdAtendimento = nil
	}

	if requestData.CompanyId != nil && *requestData.CompanyId == "" {
		requestData.CompanyId = nil
	}

	logsReportDeliveryDTO, err := reportstore.GetLogsReportDelivery(models.RequestQueryData{
		Page:          *requestData.Page,
		CdAtendimento: requestData.CdAtendimento,
		CompanyId:     requestData.CompanyId,
	})

	if err != nil {
		go aws.RegisterLog("GetLogsReportDelivery", err.Error())
		return c.JSON(http.StatusInternalServerError, models.MessageDTO{Message: "Unknown Error"})
	}

	return c.JSON(http.StatusOK, logsReportDeliveryDTO)
}

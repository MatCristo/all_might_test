package reportstore

import (
	"fmt"

	"github.com/DaviTelelaudo/all-might/internal/platform/db"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
)

func ResendReport(reportCode int) error {

	result := db.DBClinux.Exec(`
    UPDATE laudos_assinados la
    SET dt_integracao = ?
    FROM exames ex
    WHERE la.cd_laudo = ex.cd_exame
    AND ex.cd_atendimento = ?`,
		nil, reportCode,
	)

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf(`there is no signed report or exam with this code`)
	}

	return nil
}

func GetLogsReportDelivery(requestQueryData models.RequestQueryData) ([]models.LogReportDeliveryDTO, error) {

	limit := 20
	offset := requestQueryData.Page * limit

	logsReportDeliveryDTO := []models.LogReportDeliveryDTO{}

	result := db.DBClinux.Raw(`
		select lrd.id, lrd.service_desc, lrd.cd_atendimento, lrd.http_status_code,
		lrd.http_response, lrd.origin_server, lrd.created_at, lrd.report_selector_value, em.ds_empresa
		from log_report_delivery lrd
		join empresas em on lrd.facility_id = em.cd_empresa
		where ($1::int is null or lrd.cd_atendimento = $1)
		and ($2::int is null or lrd.facility_id = $2)
		order by created_at desc
		limit $3 offset $4;
	`, requestQueryData.CdAtendimento, requestQueryData.CompanyId, limit, offset).Scan(&logsReportDeliveryDTO)

	if result.Error != nil {
		return nil, result.Error
	}

	return logsReportDeliveryDTO, nil
}

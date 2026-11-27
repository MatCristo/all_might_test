package companystore

import (
	"github.com/DaviTelelaudo/all-might/internal/platform/db"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
)

func GetAllCompanies() ([]models.CompanyClinuxDTO, error) {
	var companies []models.CompanyClinuxDTO

	result := db.DBClinux.
		Raw(`
			select cd_empresa as id, ds_empresa as name
			from empresas
		`).Scan(&companies)

	if result.Error != nil {
		return nil, result.Error
	}

	return companies, nil
}

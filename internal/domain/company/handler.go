package company

import (
	"net/http"

	"github.com/DaviTelelaudo/all-might/internal/domain/company/companystore"
	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
	"github.com/labstack/echo/v4"
)

func GetAllCompanies(c echo.Context) error {
	companies, err := companystore.GetAllCompanies()

	if err != nil {
		go aws.RegisterLog("GetAllCompanies", err.Error())
		return c.JSON(http.StatusInternalServerError, models.MessageDTO{Message: "error getting the companies"})
	}

	return c.JSON(http.StatusOK, companies)
}

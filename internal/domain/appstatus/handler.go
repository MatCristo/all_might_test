package appstatus

import (
	"net/http"

	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
	"github.com/labstack/echo/v4"
)

// GetApplicationsStatus answers the on-call question: is any background
// application in trouble now, and since when? The report comes from memory
// (see cache.go); its generated_at says how fresh it is.
func GetApplicationsStatus(c echo.Context) error {
	report, err := currentReport()

	if err != nil {
		go aws.RegisterLog("GetApplicationsStatus", err.Error())
		return c.JSON(http.StatusInternalServerError, models.MessageDTO{Message: "Could not read the applications' metric"})
	}

	return c.JSON(http.StatusOK, report)
}

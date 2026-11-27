package health

import (
	"net/http"

	"github.com/DaviTelelaudo/all-might/internal/shared/models"
	"github.com/labstack/echo/v4"
)

func Health(c echo.Context) error {
	return c.JSON(http.StatusOK, models.MessageDTO{Message: "Health and running"})
}

package permission

import (
	"net/http"

	"github.com/DaviTelelaudo/all-might/internal/platform/authz"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
	"github.com/labstack/echo/v4"
)

// GetMe tells the frontend who it is talking to and which pages it may show.
//
// It replaces the `user_role` cookie the browser used to write for itself:
// with permissions granted per user, a role name can no longer describe a
// menu — two support users may now see different things. The menu is still
// only cosmetics; the API refuses on its own.
func GetMe(c echo.Context) error {
	actor, ok := authz.ActorFrom(c)

	if !ok {
		return c.JSON(http.StatusUnauthorized, models.MessageDTO{Message: "Authentication required"})
	}

	return c.JSON(http.StatusOK, models.SessionDTO{
		Id:          actor.Id,
		Name:        actor.Name,
		Role:        actor.Role,
		Permissions: actor.PermissionNames(),
	})
}

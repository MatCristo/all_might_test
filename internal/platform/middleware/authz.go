package middleware

import (
	"net/http"

	"github.com/DaviTelelaudo/all-might/internal/platform/authz"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
	"github.com/labstack/echo/v4"
)

// RequirePermission gates a route behind one page of the panel. It is attached
//
// in routes/routes.go rather than inside the handlers, so the whole policy can be
// read next to the routes it governs and a route without one stands out.
//
// The answer is 403 and never 401: the frontend sends the user back to /login
// on a 401, and a refusal that logs someone out reads as a broken session
// instead of a missing permission.
func RequirePermission(page string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			actor, ok := authz.ActorFrom(c)

			if !ok {
				return c.JSON(http.StatusUnauthorized, models.MessageDTO{
					Message: "Authentication required",
				})
			}

			if !actor.Can(page) {
				return c.JSON(http.StatusForbidden, models.MessageDTO{
					Message: "Without permission to execute this action.",
				})
			}

			return next(c)
		}
	}
}

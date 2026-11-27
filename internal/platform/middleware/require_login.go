package middleware

import (
	"errors"
	"net/http"

	"github.com/DaviTelelaudo/all-might/internal/platform/auth"
	"github.com/DaviTelelaudo/all-might/internal/platform/authz"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

// RequireLogin proves who the caller is and resolves what they may open, once
//
// per request. Everything downstream — RequirePermission, the handlers, the
// audit log — reads the actor from the context instead of querying the user
// again.
func RequireLogin(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		tokenCookie, err := c.Cookie("jwt")

		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{
				"message": "Authentication required - no token provided",
			})
		}

		userEmail, err := auth.VerifyTokenAndReturnUserEmail(tokenCookie.Value)

		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{
				"message": "Invalid token",
			})
		}

		/* A signed token for a user who no longer exists is not a session:
		   deleting someone must end their access without waiting for the
		   token to expire. */
		actor, err := authz.LoadActor(*userEmail)

		/* Only a user who is really gone ends the session. A database that is
		   briefly unreachable must not: the frontend reads 401 as "your session
		   died" and sends everyone to /login, so answering it here would turn a
		   two-second blip into a panel-wide logout. */
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.JSON(http.StatusUnauthorized, map[string]string{
				"message": "Invalid token",
			})
		}

		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"message": "Could not read the session",
			})
		}

		authz.SetActor(c, actor)
		// Kept for the handlers that still identify the user by email.
		c.Set("userEmail", *userEmail)

		return next(c)
	}
}

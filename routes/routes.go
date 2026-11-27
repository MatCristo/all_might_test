package routes

import (
	"github.com/DaviTelelaudo/all-might/internal/domain/appstatus"
	"github.com/DaviTelelaudo/all-might/internal/domain/company"
	"github.com/DaviTelelaudo/all-might/internal/domain/health"
	"github.com/DaviTelelaudo/all-might/internal/domain/permission"
	"github.com/DaviTelelaudo/all-might/internal/domain/report"
	"github.com/DaviTelelaudo/all-might/internal/domain/user"
	"github.com/DaviTelelaudo/all-might/internal/platform/authz"
	"github.com/DaviTelelaudo/all-might/internal/platform/middleware"
	"github.com/labstack/echo/v4"
)

/*
Init is the whole authorization policy of the API, in one file.

Every protected route declares the page a user must hold to reach it. A route
with no permission is public to anyone logged in — which is sometimes right
(changing your own password) and otherwise a bug.
*/
func Init(e *echo.Echo) error {

	e.POST("/api/login", user.Login)
	// Signing out only expires a cookie, so it needs no session of its own —
	// and must still work when the token it is clearing has already expired.
	e.POST("/api/logout", user.Logout)
	e.GET("/api/health", health.Health)

	protected := e.Group("")
	protected.Use(middleware.RequireLogin)

	// Who am I, and what may I open: the sidebar asks this instead of reading
	// a cookie it wrote itself.
	protected.GET("/api/me", permission.GetMe)
	// Changing your own password needs nothing but a session.
	protected.POST("/api/user/change_password", user.ResetPassword)

	reportGroup := protected.Group("/api/report", middleware.RequirePermission(authz.PageIntegracao))
	reportGroup.GET("/logs", report.GetLogsReportDelivery)
	reportGroup.POST("/resend", report.ResendReport)

	// The company name list is the Integração empresa filter.
	protected.GET("/api/company/clinux", company.GetAllCompanies, middleware.RequirePermission(authz.PageIntegracao))

	// Status das aplicações: is any background application in trouble now?
	protected.GET("/api/status/applications", appstatus.GetApplicationsStatus, middleware.RequirePermission(authz.PageStatus))

	return nil
}

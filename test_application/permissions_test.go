package test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DaviTelelaudo/all-might/internal/platform/auth"
	"github.com/DaviTelelaudo/all-might/internal/platform/authz"
	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/DaviTelelaudo/all-might/internal/platform/config"
	"github.com/DaviTelelaudo/all-might/internal/platform/db"
	"github.com/DaviTelelaudo/all-might/routes"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const adminEmail = "davi@telelaudo.com.br"

// The routes anyone with a session may call. Everything else must answer 403 to
// a user holding no pages — that is what makes "a new route is denied by
// default" a property of the API rather than a habit of whoever adds one.
var routesWithoutPermission = map[string]bool{
	"POST /api/login": true,
	// Signing out only expires a cookie. It needs no page, and it has to keep
	// working for a session that is already too broken to read.
	"POST /api/logout":               true,
	"GET /api/health":                true,
	"GET /api/me":                    true,
	"POST /api/user/change_password": true,
}

func TestPermissions(t *testing.T) {
	config.Init()

	if err := aws.Init(); err != nil {
		t.Fatalf("aws init failed: %v", err)
	}
	if err := db.Init(); err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	if err := auth.Init(); err != nil {
		t.Fatalf("auth init failed: %v", err)
	}

	db.TestInitTransaction()
	defer db.TestRollback()

	e := echo.New()
	require.NoError(t, routes.Init(e))

	t.Run("EveryProtectedRouteDeniesAUserWithoutPages", func(t *testing.T) {
		runDefaultDenyTests(t, e)
	})

	t.Run("Me", func(t *testing.T) {
		runMeTests(t, e)
	})

	t.Run("PageReach", func(t *testing.T) {
		runPageReachTests(t, e)
	})
}

// jwtCookie builds the session cookie the middleware reads, so the tests go
// through the real route table — middleware included — instead of calling
// handlers directly.
func jwtCookie(t *testing.T, email string) *http.Cookie {
	t.Helper()

	token, err := auth.CreateToken(email)
	require.NoError(t, err)

	return &http.Cookie{Name: "jwt", Value: token}
}

func request(t *testing.T, e *echo.Echo, method, path, email string, body any) *httptest.ResponseRecorder {
	t.Helper()

	var reader *bytes.Reader

	if body != nil {
		encoded, err := json.Marshal(body)
		require.NoError(t, err)
		reader = bytes.NewReader(encoded)
	} else {
		reader = bytes.NewReader(nil)
	}

	req := httptest.NewRequest(method, path, reader)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.AddCookie(jwtCookie(t, email))

	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	return rec
}

// userWithPages inserts a user holding exactly the given pages. The rollback at
// the end of the suite takes the rows away again.
func userWithPages(t *testing.T, pages ...string) string {
	t.Helper()

	// users.name is unique, so each helper call needs its own.
	suffix := uuid.NewString()[:8]
	email := fmt.Sprintf("pages.%s@telelaudo.com.br", suffix)

	var id string
	require.NoError(t, db.DBTIApplications.Raw(`
		INSERT INTO users (name, email, password, id_role)
		VALUES (?, ?, 'hash', (SELECT id FROM roles WHERE name = 'support'))
		RETURNING id`, "usuario "+suffix, email).Scan(&id).Error)

	for _, page := range pages {
		require.NoError(t, db.DBTIApplications.Exec(`
			INSERT INTO user_permissions (id_user, id_permission)
			SELECT ?, id FROM permissions WHERE name = ?`, id, page).Error)
	}

	return email
}

func runDefaultDenyTests(t *testing.T, e *echo.Echo) {
	email := userWithPages(t)

	checked := 0

	for _, route := range e.Routes() {
		/* Echo adds a not-found handler of its own for every group prefix.
		   Those are not endpoints anyone calls, and they answer 404 by
		   design. */
		if route.Method == echo.RouteNotFound || route.Path == "" {
			continue
		}

		if strings.Contains(route.Path, "*") || route.Method == http.MethodHead || route.Method == http.MethodOptions {
			continue
		}

		if routesWithoutPermission[route.Method+" "+route.Path] {
			continue
		}

		path := strings.ReplaceAll(route.Path, ":id", uuid.NewString())

		rec := request(t, e, route.Method, path, email, map[string]any{})

		assert.Equalf(t, http.StatusForbidden, rec.Code,
			"%s %s answered %d to a user with no pages — every protected route needs a permission in routes/routes.go",
			route.Method, route.Path, rec.Code)

		checked++
	}

	assert.Greater(t, checked, 0, "the route table looks empty — did routes.Init change?")
}

func runMeTests(t *testing.T, e *echo.Echo) {
	rec := request(t, e, http.MethodGet, "/api/me", adminEmail, nil)
	require.Equal(t, http.StatusOK, rec.Code)

	var me struct {
		Name        string   `json:"name"`
		Role        string   `json:"role"`
		Permissions []string `json:"permissions"`
	}

	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &me))

	assert.Equal(t, "admin", me.Role, "the role is still reported, as a label")
	assert.Contains(t, me.Permissions, authz.PageIntegracao)
}

// A user holding Integração reaches every route behind it.
func runPageReachTests(t *testing.T, e *echo.Echo) {
	email := userWithPages(t, authz.PageIntegracao)

	for _, path := range []string{
		"/api/company/clinux",
		"/api/report/logs?page=0",
	} {
		rec := request(t, e, http.MethodGet, path, email, nil)
		assert.Equalf(t, http.StatusOK, rec.Code, "%s answered %d to a user holding Integração", path, rec.Code)
	}

	// Each page opens only its own routes.
	rec := request(t, e, http.MethodGet, "/api/status/applications", email, nil)
	assert.Equal(t, http.StatusForbidden, rec.Code, "Integração alone must not open Status das aplicações")

	statusEmail := userWithPages(t, authz.PageStatus)

	rec = request(t, e, http.MethodGet, "/api/status/applications", statusEmail, nil)
	assert.Equal(t, http.StatusOK, rec.Code, "a user holding Status das aplicações reaches its route")

	rec = request(t, e, http.MethodGet, "/api/report/logs?page=0", statusEmail, nil)
	assert.Equal(t, http.StatusForbidden, rec.Code, "Status das aplicações alone must not open Integração")
}

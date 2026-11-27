package test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DaviTelelaudo/all-might/internal/platform/auth"
	"github.com/DaviTelelaudo/all-might/internal/platform/authz"
	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/DaviTelelaudo/all-might/internal/platform/config"
	"github.com/DaviTelelaudo/all-might/internal/platform/db"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
	"github.com/DaviTelelaudo/all-might/routes"
	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

/*
A session lasts as long in the browser as it does in the API.

The token's `exp` and the cookie's `MaxAge` are set in two different files, and
nothing but this test stops them from drifting apart. When they do, the failure
is quiet: a cookie that expires first logs people out while their token is still
good, and a cookie that outlives the token makes every request 401 with a
session the browser still believes in.
*/
func TestSessionLifetime(t *testing.T) {
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

	require.Equal(t, 7*24*time.Hour, auth.SessionLifetime, "a login is meant to last a week")

	e := echo.New()
	require.NoError(t, routes.Init(e))

	body, err := json.Marshal(map[string]string{
		"email":    adminEmail,
		"password": "davi1234",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/login", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var session *http.Cookie

	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == "jwt" {
			session = cookie
		}
	}

	require.NotNil(t, session, "login must set the jwt cookie")

	assert.Equal(t, int(auth.SessionLifetime.Seconds()), session.MaxAge,
		"the cookie must live exactly as long as the token it carries")

	claims := jwt.MapClaims{}
	_, _, err = jwt.NewParser().ParseUnverified(session.Value, claims)
	require.NoError(t, err)

	expiry, err := claims.GetExpirationTime()
	require.NoError(t, err)

	// A second of slack: the token is signed a moment before it is read here.
	assert.WithinDuration(t, time.Now().Add(auth.SessionLifetime), expiry.Time, time.Second,
		"the token must expire when the cookie does")
}

/*
Login answers with the session it just created.

The login page reads the granted pages from this answer to know where to send
someone. It used to ask GET /api/me instead, and that request left while the
browser was still receiving the login response — so it carried no cookie, came
back 401 "no token provided", and the person had to log in a second time for it
to stick. Nothing here can catch that race by itself; what it can do is keep the
payload that removed the need for the second request.
*/
func TestLoginAnswersWithTheSession(t *testing.T) {
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

	// The seeded support user, who holds Integração.
	body, err := json.Marshal(map[string]string{
		"email":    "teste.support@telelaudo.com.br",
		"password": "teste1234",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/login", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var session models.SessionDTO
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &session))

	assert.Equal(t, "Login successful", session.Message, "the old message is still there")
	assert.Equal(t, "support", session.Role)
	assert.NotEmpty(t, session.Name)
	assert.Contains(t, session.Permissions, authz.PageIntegracao,
		"without the pages in this answer the page cannot decide where to land")

	// And it is the same session GET /api/me would have answered with — the
	// request the page no longer has to make.
	me := request(t, e, http.MethodGet, "/api/me", "teste.support@telelaudo.com.br", nil)
	require.Equal(t, http.StatusOK, me.Code)

	var fromMe models.SessionDTO
	require.NoError(t, json.Unmarshal(me.Body.Bytes(), &fromMe))

	assert.Empty(t, fromMe.Message, "/api/me has nothing to announce")

	fromMe.Message = session.Message
	assert.Equal(t, session, fromMe, "login and /api/me must describe the same session")
}

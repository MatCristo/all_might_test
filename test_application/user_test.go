package test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DaviTelelaudo/all-might/internal/domain/user"
	"github.com/DaviTelelaudo/all-might/internal/domain/user/userstore"
	"github.com/DaviTelelaudo/all-might/internal/platform/auth"
	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/DaviTelelaudo/all-might/internal/platform/config"
	"github.com/DaviTelelaudo/all-might/internal/platform/db"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUser(t *testing.T) {
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

	// Run Login Tests
	t.Run("Login", func(t *testing.T) {
		runLoginTests(t, e)
	})

	t.Run("ResetPassword", func(t *testing.T) {
		runResetPasswordTests(t, e)
	})
}

func runLoginTests(t *testing.T, e *echo.Echo) {
	// Seeded by test/database/create_database.sql.
	setupUserEmail := "davi@telelaudo.com.br"
	setupPassword := "davi1234"

	tests := []struct {
		name           string
		payload        interface{}
		expectedStatus int
		expectedMsg    string
		expectCookie   bool
	}{
		{
			name:           "Invalid JSON",
			payload:        "invalid-string-not-json",
			expectedStatus: http.StatusBadRequest,
			expectedMsg:    "Bad request",
		},
		{
			name: "Wrong Password",
			payload: map[string]string{
				"email":    setupUserEmail,
				"password": "wrong-password-here",
			},
			expectedStatus: http.StatusBadRequest,
			expectedMsg:    "Wrong Password.",
		},
		{
			name: "Email Not Found",
			payload: map[string]string{
				"email":    "nonexistent@telelaudo.com.br",
				"password": "any",
			},
			expectedStatus: http.StatusBadRequest,
			expectedMsg:    "Not found a user with that email.",
		},
		{
			name: "Success Login",
			payload: map[string]string{
				"email":    setupUserEmail,
				"password": setupPassword,
			},
			expectedStatus: http.StatusOK,
			expectedMsg:    "Login successful",
			expectCookie:   true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			err := user.Login(c)

			if assert.NoError(t, err) {
				assert.Equal(t, tc.expectedStatus, rec.Code)

				var res map[string]string
				json.Unmarshal(rec.Body.Bytes(), &res)
				assert.Contains(t, res["message"], tc.expectedMsg)

				if tc.expectCookie {
					cookies := rec.Result().Cookies()
					var jwtCookie *http.Cookie
					for _, ck := range cookies {
						if ck.Name == "jwt" {
							jwtCookie = ck
						}
					}

					require.NotNil(t, jwtCookie, "Login successful but jwt cookie was not found")
					assert.NotEmpty(t, jwtCookie.Value)
					assert.True(t, jwtCookie.HttpOnly)
					assert.Equal(t, http.SameSiteStrictMode, jwtCookie.SameSite)
				}
			}
		})
	}
}

func runResetPasswordTests(t *testing.T, e *echo.Echo) {
	userEmail := "test2@telelaudo.com.br"
	oldPassword := "davi1234"

	tests := []struct {
		name           string
		payload        interface{}
		contextEmail   interface{}
		expectedStatus int
		expectedMsg    string
	}{
		{
			name:           "Invalid JSON",
			payload:        "invalid",
			contextEmail:   userEmail,
			expectedStatus: http.StatusBadRequest,
			expectedMsg:    "Requisição inválida",
		},
		{
			name: "Wrong Current Password",
			payload: map[string]string{
				"password":    "wrong_current_password",
				"newPassword": "newSecurePassword123",
			},
			contextEmail:   userEmail,
			expectedStatus: http.StatusBadRequest,
			expectedMsg:    "Senha atual incorreta",
		},
		{
			name: "New Password Too Short",
			payload: map[string]string{
				"password":    oldPassword,
				"newPassword": "short",
			},
			contextEmail:   userEmail,
			expectedStatus: http.StatusBadRequest,
			expectedMsg:    "A nova senha deve ter pelo menos 8 caracteres",
		},
		{
			name: "Success Reset",
			payload: map[string]string{
				"password":    oldPassword,
				"newPassword": "newSecurePassword123",
			},
			contextEmail:   userEmail,
			expectedStatus: http.StatusOK,
			expectedMsg:    "Senha alterada com sucesso!",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest(http.MethodPost, "/reset-password", bytes.NewReader(body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()

			c := e.NewContext(req, rec)
			if tc.contextEmail != nil {
				c.Set("userEmail", tc.contextEmail)
			}

			err := user.ResetPassword(c)

			if assert.NoError(t, err) {
				assert.Equal(t, tc.expectedStatus, rec.Code)

				var res map[string]string
				json.Unmarshal(rec.Body.Bytes(), &res)
				assert.Contains(t, res["message"], tc.expectedMsg)

				if tc.expectedStatus == http.StatusOK {
					user, _ := userstore.GetUserByEmail(userEmail)
					assert.False(t, auth.CheckPasswordHash(oldPassword, user.Password))
					assert.True(t, auth.CheckPasswordHash("newSecurePassword123", user.Password))
				}
			}
		})
	}
}

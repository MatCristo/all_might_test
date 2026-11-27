package test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DaviTelelaudo/all-might/internal/domain/company"
	"github.com/DaviTelelaudo/all-might/internal/platform/auth"
	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/DaviTelelaudo/all-might/internal/platform/config"
	"github.com/DaviTelelaudo/all-might/internal/platform/db"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompanies(t *testing.T) {
	// Initialize environment
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
	// Start transaction and ensure cleanup
	db.TestInitTransaction()
	defer db.TestRollback()

	e := echo.New()

	// Run Company Tests
	t.Run("GetAllCompanies", func(t *testing.T) {
		runGetAllCompaniesTests(t, e)
	})
}

func runGetAllCompaniesTests(t *testing.T, e *echo.Echo) {
	t.Run("Success Get All Companies", func(t *testing.T) {
		// Prepare request
		req := httptest.NewRequest(http.MethodGet, "/companies", nil)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)

		// Execute controller
		err := company.GetAllCompanies(c)

		// Assertions
		if assert.NoError(t, err) {
			assert.Equal(t, http.StatusOK, rec.Code)

			// Validate that the response is a JSON array
			var companies []map[string]interface{}
			err := json.Unmarshal(rec.Body.Bytes(), &companies)
			require.NoError(t, err, "Response body should be a valid JSON array of companies")

			// Note: Even if the DB is empty, it should return an empty slice [], not null or an error
			assert.NotNil(t, companies)
		}
	})
}

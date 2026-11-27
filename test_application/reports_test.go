package test

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DaviTelelaudo/all-might/internal/domain/report"
	"github.com/DaviTelelaudo/all-might/internal/platform/auth"
	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/DaviTelelaudo/all-might/internal/platform/config"
	"github.com/DaviTelelaudo/all-might/internal/platform/db"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
)

func TestReportControllers(t *testing.T) {
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
	/*if err := api.Init(); err != nil {
		t.Fatalf("api init failed: %v", err)
	}*/

	e := echo.New()

	// Start transaction and ensure cleanup
	db.TestInitTransaction()
	defer db.TestRollback()
	// 2. Tests for ResendReport
	t.Run("ResendReport", func(t *testing.T) {
		runResendReport(t, e)
	})

	// 3. Tests for GetLogsReportDelivery
	t.Run("GetLogsReportDelivery", func(t *testing.T) {
		runGetLogsReportDelivery(t, e)
	})
}

func runResendReport(t *testing.T, e *echo.Echo) {
	// ID 6423450 exists in your seed data (laudos_assinados table)
	existingReportCode := 937031

	tests := []struct {
		name           string
		body           interface{}
		expectedStatus int
		verify         func(t *testing.T)
	}{
		{
			name:           "Success - Mark for Resend",
			body:           map[string]interface{}{"report_code": existingReportCode},
			expectedStatus: http.StatusOK,
			verify: func(t *testing.T) {
				// Verify dt_integracao is now NULL
				var dtIntegracao sql.NullTime

				db.DBClinux.Raw(`
					select la.dt_integracao 
					from laudos_assinados la
					join exames ex
					on la.cd_laudo = ex.cd_exame
					where
					ex.cd_atendimento = ?`,
					existingReportCode).Scan(&dtIntegracao)
				assert.False(t, dtIntegracao.Valid, "Expected dt_integracao to be NULL")
			},
		},
		{
			name:           "Not Found - Invalid Code",
			body:           map[string]interface{}{"report_code": 9999999},
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "Bad Request - Missing Field",
			body:           map[string]interface{}{"invalid_key": 123},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {

			body, _ := json.Marshal(tc.body)
			req := httptest.NewRequest(http.MethodPost, "/report/resend", bytes.NewBuffer(body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			err := report.ResendReport(c)
			if assert.NoError(t, err) {
				assert.Equal(t, tc.expectedStatus, rec.Code)
				if tc.verify != nil {
					tc.verify(t)
				}
			}
		})
	}
}

func runGetLogsReportDelivery(t *testing.T, e *echo.Echo) {
	// cd_atendimento 6435629 exists in seed log_report_delivery
	existingAtendimento := "937031"

	tests := []struct {
		name           string
		queryParams    string
		expectedStatus int
		verify         func(t *testing.T, rec *httptest.ResponseRecorder)
	}{
		{
			name:           "Success - List First Page",
			queryParams:    "page=0",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Success - Filter by Attendance",
			queryParams:    "cd_atendimento=" + existingAtendimento,
			expectedStatus: http.StatusOK,
			verify: func(t *testing.T, rec *httptest.ResponseRecorder) {
				var logs []map[string]interface{}
				json.Unmarshal(rec.Body.Bytes(), &logs)
				assert.GreaterOrEqual(t, len(logs), 1)
				actualValue := fmt.Sprintf("%.0f", logs[0]["cd_atendimento"])
				assert.Equal(t, existingAtendimento, actualValue)
			},
		},
		{
			// facility_id 2 is seeded on several log_report_delivery rows, all
			// belonging to the same empresa.
			name:           "Success - Filter by Company",
			queryParams:    "company_id=2",
			expectedStatus: http.StatusOK,
			verify: func(t *testing.T, rec *httptest.ResponseRecorder) {
				var logs []map[string]interface{}
				json.Unmarshal(rec.Body.Bytes(), &logs)
				assert.GreaterOrEqual(t, len(logs), 1)

				// Every row must belong to the one company that was asked for.
				companyName := logs[0]["company_name"]
				for _, log := range logs {
					assert.Equal(t, companyName, log["company_name"])
				}
			},
		},
		{
			// A blank param must mean "no filter", not ''::int, which errors.
			name:           "Success - Blank Company Is Ignored",
			queryParams:    "page=0&company_id=&cd_atendimento=",
			expectedStatus: http.StatusOK,
			verify: func(t *testing.T, rec *httptest.ResponseRecorder) {
				var logs []map[string]interface{}
				json.Unmarshal(rec.Body.Bytes(), &logs)
				assert.GreaterOrEqual(t, len(logs), 1)
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {

			req := httptest.NewRequest(http.MethodGet, "/reports/logs?"+tc.queryParams, nil)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			err := report.GetLogsReportDelivery(c)
			if assert.NoError(t, err) {
				assert.Equal(t, tc.expectedStatus, rec.Code)
				if tc.verify != nil {
					tc.verify(t, rec)
				}
			}
		})
	}
}

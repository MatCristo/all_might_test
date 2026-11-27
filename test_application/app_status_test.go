package test

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/DaviTelelaudo/all-might/internal/domain/appstatus"
	"github.com/DaviTelelaudo/all-might/internal/platform/auth"
	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/DaviTelelaudo/all-might/internal/platform/config"
	"github.com/DaviTelelaudo/all-might/internal/platform/db"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
	"github.com/DaviTelelaudo/all-might/routes"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A fixed "now", so every scenario is reproducible.
var statusNow = time.Date(2026, 11, 27, 12, 0, 0, 0, time.UTC)
var statusWindowStart = statusNow.Add(-appstatus.Window)

// periodsAgo is the start of the period n periods before statusNow.
func periodsAgo(n int) time.Time {
	return statusNow.Add(-time.Duration(n) * appstatus.Period)
}

// week builds one point per period of the whole window, asking valueAt for
// each one (n periods ago). A nil value leaves that period without data.
func week(valueAt func(n int) *float64) []aws.MetricPoint {
	points := []aws.MetricPoint{}
	total := int(appstatus.Window / appstatus.Period)

	for n := total; n >= 1; n-- {
		if value := valueAt(n); value != nil {
			points = append(points, aws.MetricPoint{Timestamp: periodsAgo(n), Value: *value})
		}
	}

	return points
}

var one, zero = 1.0, 0.0

func TestApplicationStatusLogic(t *testing.T) {

	t.Run("HealthyAllWeek", func(t *testing.T) {
		app := appstatus.BuildApplicationStatus("a", week(func(int) *float64 { return &one }), statusWindowStart, statusNow)

		assert.Equal(t, models.StatusOK, app.Status)
		assert.Equal(t, statusWindowStart, app.Since, "ok the whole window: since the window start")
		assert.Equal(t, 0, app.FailedPeriods)
		assert.Len(t, app.Segments, 1)
	})

	t.Run("FailingNowSinceTheFirstZero", func(t *testing.T) {
		// The last 36 periods (3 hours) were late.
		app := appstatus.BuildApplicationStatus("a", week(func(n int) *float64 {
			if n <= 36 {
				return &zero
			}
			return &one
		}), statusWindowStart, statusNow)

		assert.Equal(t, models.StatusFailing, app.Status)
		assert.Equal(t, periodsAgo(36), app.Since)
		assert.Equal(t, 36, app.FailedPeriods)
	})

	t.Run("RecoveredIsOkSinceTheRecovery", func(t *testing.T) {
		// Failed between 600 and 500 periods ago, fine since.
		app := appstatus.BuildApplicationStatus("a", week(func(n int) *float64 {
			if n <= 600 && n > 500 {
				return &zero
			}
			return &one
		}), statusWindowStart, statusNow)

		assert.Equal(t, models.StatusOK, app.Status, "an old failure is history, not an alarm")
		assert.Equal(t, periodsAgo(500), app.Since)
		assert.Equal(t, 100, app.FailedPeriods)
		assert.Len(t, app.Segments, 3)
	})

	t.Run("SilentNowIsNoDataSinceTheLastPeriodEnded", func(t *testing.T) {
		// Nothing in the last 12 periods (1 hour).
		app := appstatus.BuildApplicationStatus("a", week(func(n int) *float64 {
			if n <= 12 {
				return nil
			}
			return &one
		}), statusWindowStart, statusNow)

		assert.Equal(t, models.StatusNoData, app.Status)
		assert.Equal(t, periodsAgo(12), app.Since)
		require.NotNil(t, app.LastDataAt)
		assert.Equal(t, periodsAgo(13), *app.LastDataAt)
	})

	t.Run("NewestPeriodMissingIsNotAnAlarm", func(t *testing.T) {
		// Only the newest period is missing: it may just not have arrived.
		app := appstatus.BuildApplicationStatus("a", week(func(n int) *float64 {
			if n <= 1 {
				return nil
			}
			return &one
		}), statusWindowStart, statusNow)

		assert.Equal(t, models.StatusOK, app.Status)
	})

	t.Run("FailureWithLateNewestPointIsStillOngoing", func(t *testing.T) {
		// Failing for 3 hours, and the two newest periods have not arrived yet.
		app := appstatus.BuildApplicationStatus("a", week(func(n int) *float64 {
			if n <= 2 {
				return nil
			}
			if n <= 36 {
				return &zero
			}
			return &one
		}), statusWindowStart, statusNow)

		last := app.Segments[len(app.Segments)-1]

		assert.Equal(t, models.StatusFailing, app.Status)
		assert.Equal(t, periodsAgo(36), app.Since)
		assert.Equal(t, statusNow, last.End, "the failure runs up to now, not to the last point")
	})

	t.Run("OldGapIsASegmentButNotTheCurrentState", func(t *testing.T) {
		app := appstatus.BuildApplicationStatus("a", week(func(n int) *float64 {
			if n <= 1200 && n > 1128 {
				return nil
			}
			return &one
		}), statusWindowStart, statusNow)

		assert.Equal(t, models.StatusOK, app.Status)
		require.Len(t, app.Segments, 3)
		assert.Equal(t, models.StatusNoData, app.Segments[1].Status)
		assert.Equal(t, periodsAgo(1200), app.Segments[1].Start)
		assert.Equal(t, periodsAgo(1128), app.Segments[1].End)
	})

	t.Run("NoPointsAtAll", func(t *testing.T) {
		app := appstatus.BuildApplicationStatus("a", nil, statusWindowStart, statusNow)

		assert.Equal(t, models.StatusNoData, app.Status)
		assert.Equal(t, statusWindowStart, app.Since)
		assert.Nil(t, app.LastDataAt)
	})

	t.Run("PointsOutOfOrderAndDuplicatedKeepTheMaximum", func(t *testing.T) {
		points := []aws.MetricPoint{
			{Timestamp: periodsAgo(1).Add(time.Minute), Value: 0},
			{Timestamp: periodsAgo(2), Value: 1},
			{Timestamp: periodsAgo(1), Value: 1},
		}

		app := appstatus.BuildApplicationStatus("a", points, periodsAgo(2), statusNow)

		assert.Equal(t, models.StatusOK, app.Status, "Maximum of 0 and 1 in the same period is 1")
		assert.Equal(t, 0, app.FailedPeriods)
	})

	t.Run("ReportListsProblemsFirst", func(t *testing.T) {
		healthy := week(func(int) *float64 { return &one })
		failing := week(func(n int) *float64 {
			if n <= 3 {
				return &zero
			}
			return &one
		})

		report := appstatus.BuildReport(map[string][]aws.MetricPoint{
			"b-ok":      healthy,
			"a-ok":      healthy,
			"z-failing": failing,
			"silent":    nil,
		}, statusWindowStart, statusNow)

		names := []string{}
		for _, app := range report.Applications {
			names = append(names, app.Name)
		}

		assert.Equal(t, []string{"z-failing", "silent", "a-ok", "b-ok"}, names)
		assert.Equal(t, 300, report.PeriodSeconds)
	})
}

// The route against the metric seeded in LocalStack. The scenarios themselves
// are checked above with fixed data: the seed is relative to when LocalStack
// started, so here we only check what does not depend on the clock.
func TestApplicationStatusRoute(t *testing.T) {
	config.Init()

	require.NoError(t, aws.Init())
	require.NoError(t, db.Init())
	require.NoError(t, auth.Init())

	db.TestInitTransaction()
	defer db.TestRollback()

	e := echo.New()
	require.NoError(t, routes.Init(e))

	rec := request(t, e, http.MethodGet, "/api/status/applications", adminEmail, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var report models.ApplicationStatusReportDTO
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &report))

	names := map[string]bool{}
	for _, app := range report.Applications {
		names[app.Name] = true

		assert.Contains(t, []string{models.StatusOK, models.StatusFailing, models.StatusNoData}, app.Status)
		assert.NotEmpty(t, app.Segments, "%s has no segments", app.Name)
	}

	for _, expected := range []string{"storelts", "clinuxsend", "critical-notifier", "eleva-integration", "notify-hearp"} {
		assert.True(t, names[expected], "%s is missing from the report", expected)
	}

	assert.Len(t, report.Applications, 10)
}

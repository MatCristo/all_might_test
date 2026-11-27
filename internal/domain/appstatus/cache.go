package appstatus

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/DaviTelelaudo/all-might/internal/domain/appstatus/appstatusstore"
	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
)

/*
The report is kept in memory and rebuilt in the background once per period.

The metric only changes every 5 minutes, so reading CloudWatch on every page
load would only repeat the same answer — and GetMetricData is billed per metric
read, so the bill would grow with every person on call refreshing the page.
It also keeps the page instant on LocalStack, which takes close to a minute to
answer 7 days of 5-minute periods for ten applications.
*/

// How long a refresh may take before it is abandoned.
const refreshTimeout = 3 * time.Minute

var (
	// The latest report. Read without locking; replaced whole on refresh.
	cachedReport atomic.Pointer[models.ApplicationStatusReportDTO]
	// Only one refresh at a time: whoever waits gets the one just built.
	refreshing sync.Mutex
	// When the cached report was read from CloudWatch.
	cachedAt atomic.Pointer[time.Time]

	// The last failed refresh and when it happened, guarded by refreshing.
	// While there is no report yet, every request waits on refreshing; without
	// this, each one would ask CloudWatch again (up to refreshTimeout each) when
	// it is down, and the last in line would wait for all of them.
	lastError error
	failedAt  time.Time

	// Where the executions come from; the tests swap it for a fake.
	getExecutions = appstatusstore.GetExecutions
)

// StartRefresher builds the report now and again every period, for as long as
// the API runs, so no request ever waits for CloudWatch.
func StartRefresher() {
	go func() {
		for {
			if _, err := refresh(); err != nil {
				aws.RegisterLog("AppStatusRefresher", err.Error())
			}

			time.Sleep(Period)
		}
	}()
}

// currentReport is the cached report, or a fresh one when there is none yet
// (right after startup, or in the tests, which do not start the refresher).
func currentReport() (*models.ApplicationStatusReportDTO, error) {
	if report := cachedReport.Load(); report != nil {
		return report, nil
	}

	return refresh()
}

func refresh() (*models.ApplicationStatusReportDTO, error) {
	refreshing.Lock()
	defer refreshing.Unlock()

	// Someone else refreshed while we waited for the lock: use theirs.
	if at := cachedAt.Load(); at != nil && time.Since(*at) < Period/2 {
		return cachedReport.Load(), nil
	}

	// A refresh just failed while we waited: answer with its error at once.
	if lastError != nil && time.Since(failedAt) < Period/2 {
		return nil, lastError
	}

	ctx, cancel := context.WithTimeout(context.Background(), refreshTimeout)
	defer cancel()

	// Aligned to the period, so CloudWatch is asked for whole periods and the
	// newest, still incomplete one is left out.
	now := time.Now().UTC().Truncate(Period)
	windowStart := now.Add(-Window)

	executions, err := getExecutions(ctx, windowStart, now, Period)

	if err != nil {
		lastError, failedAt = err, time.Now()
		return nil, err
	}

	lastError = nil

	report := BuildReport(executions, windowStart, now)
	readAt := time.Now()

	cachedReport.Store(&report)
	cachedAt.Store(&readAt)

	return &report, nil
}

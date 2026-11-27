package appstatus

import (
	"sort"
	"time"

	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/DaviTelelaudo/all-might/internal/shared/models"
)

const (
	// The metric is published every 5 minutes.
	Period = 5 * time.Minute
	// How far back the page looks — the same 7 days as the AWS dashboard.
	Window = 7 * 24 * time.Hour
	// How long without any point before an application counts as "no data"
	// now. The newest period may simply not have arrived yet, so one missing
	// period is not an alarm; three in a row are.
	StaleAfter = 3 * Period
)

// statusOrder puts what needs attention first on the page.
var statusOrder = map[string]int{
	models.StatusFailing: 0,
	models.StatusNoData:  1,
	models.StatusOK:      2,
}

// BuildReport turns the raw points of every application into the page's
// answer. It is pure — no AWS, no clock — so every scenario can be tested with
// hand-made points and a fixed "now".
func BuildReport(executions map[string][]aws.MetricPoint, windowStart, now time.Time) models.ApplicationStatusReportDTO {
	applications := make([]models.ApplicationStatusDTO, 0, len(executions))

	for name, points := range executions {
		applications = append(applications, BuildApplicationStatus(name, points, windowStart, now))
	}

	// Failing first, then no data, then fine; alphabetical within each.
	sort.Slice(applications, func(i, j int) bool {
		a, b := applications[i], applications[j]

		if statusOrder[a.Status] != statusOrder[b.Status] {
			return statusOrder[a.Status] < statusOrder[b.Status]
		}

		return a.Name < b.Name
	})

	return models.ApplicationStatusReportDTO{
		GeneratedAt:   now,
		WindowStart:   windowStart,
		PeriodSeconds: int(Period.Seconds()),
		Applications:  applications,
	}
}

// BuildApplicationStatus walks one application's points from oldest to newest
// and groups them into segments of one state. A missing period becomes a
// no_data segment; the last segment is the current state.
func BuildApplicationStatus(name string, points []aws.MetricPoint, windowStart, now time.Time) models.ApplicationStatusDTO {
	points = normalize(points)

	app := models.ApplicationStatusDTO{
		Name:     name,
		Segments: []models.StatusSegmentDTO{},
	}

	// cursor is where the previous point's period ended: a point that starts
	// later than the cursor means the periods in between had no data.
	cursor := windowStart

	for _, point := range points {
		if point.Timestamp.Before(windowStart) || !point.Timestamp.Before(now) {
			continue
		}

		if point.Timestamp.After(cursor) {
			app.Segments = appendSegment(app.Segments, models.StatusNoData, cursor, point.Timestamp)
		}

		status := models.StatusOK
		if point.Value < 1 {
			status = models.StatusFailing
			app.FailedPeriods++
		}

		end := point.Timestamp.Add(Period)
		app.Segments = appendSegment(app.Segments, status, point.Timestamp, end)

		lastDataAt := point.Timestamp
		app.LastDataAt = &lastDataAt
		cursor = end
	}

	// The tail: silent for too long means "no data" now. A shorter silence is
	// just the newest period still on its way, and the last state stands.
	if app.LastDataAt == nil || now.Sub(*app.LastDataAt) > StaleAfter {
		app.Segments = appendSegment(app.Segments, models.StatusNoData, cursor, now)
	} else {
		// The last state holds until now, so it reads as still going on (a
		// failure is not shown as over just because the newest point is late).
		app.Segments[len(app.Segments)-1].End = now
	}

	current := app.Segments[len(app.Segments)-1]
	app.Status = current.Status
	app.Since = current.Start

	return app
}

// appendSegment extends the last segment when it has the same state and
// touches the new stretch; otherwise it starts a new one.
func appendSegment(segments []models.StatusSegmentDTO, status string, start, end time.Time) []models.StatusSegmentDTO {
	if !end.After(start) {
		return segments
	}

	if n := len(segments); n > 0 && segments[n-1].Status == status && segments[n-1].End.Equal(start) {
		segments[n-1].End = end
		return segments
	}

	return append(segments, models.StatusSegmentDTO{Status: status, Start: start, End: end})
}

// normalize sorts the points oldest first, aligns each one to the start of its
// period and keeps the Maximum when two fall in the same period — CloudWatch
// already does this, but the logic should not depend on it.
func normalize(points []aws.MetricPoint) []aws.MetricPoint {
	byPeriod := map[time.Time]float64{}

	for _, point := range points {
		start := point.Timestamp.UTC().Truncate(Period)

		if value, ok := byPeriod[start]; !ok || point.Value > value {
			byPeriod[start] = point.Value
		}
	}

	normalized := make([]aws.MetricPoint, 0, len(byPeriod))

	for start, value := range byPeriod {
		normalized = append(normalized, aws.MetricPoint{Timestamp: start, Value: value})
	}

	sort.Slice(normalized, func(i, j int) bool {
		return normalized[i].Timestamp.Before(normalized[j].Timestamp)
	})

	return normalized
}

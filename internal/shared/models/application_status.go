package models

import "time"

// The state of an application during a stretch of time.
const (
	StatusOK      = "ok"      // its runs finished on time (ExecucaoNoPrazo = 1)
	StatusFailing = "failing" // its runs were late or failed (ExecucaoNoPrazo = 0)
	StatusNoData  = "no_data" // it published nothing
)

// ApplicationStatusReportDTO is the whole "Status das aplicações" page.
type ApplicationStatusReportDTO struct {
	GeneratedAt   time.Time              `json:"generated_at"`
	WindowStart   time.Time              `json:"window_start"`
	PeriodSeconds int                    `json:"period_seconds"`
	Applications  []ApplicationStatusDTO `json:"applications"`
}

// ApplicationStatusDTO answers, for one application: is it fine now, since
// when, and what did the window look like.
type ApplicationStatusDTO struct {
	Name string `json:"name"`
	// Current state: ok, failing or no_data.
	Status string `json:"status"`
	// When the current state began. Equal to the report's window_start when it
	// lasted the whole window, so "at least since".
	Since time.Time `json:"since"`
	// The start of the last period with data; null when there was none.
	LastDataAt *time.Time `json:"last_data_at"`
	// How many periods of the window were late or failed.
	FailedPeriods int `json:"failed_periods"`
	// The window as consecutive stretches of one state, oldest first.
	Segments []StatusSegmentDTO `json:"segments"`
}

// StatusSegmentDTO is a stretch of time in one state, from Start (inclusive)
// to End (exclusive).
type StatusSegmentDTO struct {
	Status string    `json:"status"`
	Start  time.Time `json:"start"`
	End    time.Time `json:"end"`
}

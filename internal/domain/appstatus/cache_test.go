package appstatus

// This test lives next to the cache, not in test_application/, because what it
// checks is private state (how many times CloudWatch is asked) and it needs to
// swap getExecutions for a fake: no LocalStack, no database.

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
	"github.com/stretchr/testify/assert"
)

// resetCache empties the cache and puts the real source back when the test ends.
func resetCache(t *testing.T, fake func(context.Context, time.Time, time.Time, time.Duration) (map[string][]aws.MetricPoint, error)) {
	original := getExecutions
	getExecutions = fake

	empty := func() {
		cachedReport.Store(nil)
		cachedAt.Store(nil)
		lastError, failedAt = nil, time.Time{}
	}

	empty()
	t.Cleanup(func() {
		getExecutions = original
		empty()
	})
}

// askAtOnce calls currentReport from n requests at the same time.
func askAtOnce(n int) []error {
	errs := make([]error, n)
	var wg sync.WaitGroup

	for i := range errs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, errs[i] = currentReport()
		}()
	}

	wg.Wait()
	return errs
}

func TestCacheFailureIsNotRepeatedByQueuedRequests(t *testing.T) {
	var calls atomic.Int32
	down := errors.New("cloudwatch is down")

	resetCache(t, func(context.Context, time.Time, time.Time, time.Duration) (map[string][]aws.MetricPoint, error) {
		calls.Add(1)
		time.Sleep(50 * time.Millisecond) // a slow failure, so the others queue up
		return nil, down
	})

	for _, err := range askAtOnce(5) {
		assert.ErrorIs(t, err, down)
	}

	assert.Equal(t, int32(1), calls.Load(), "only the first request should have asked CloudWatch")
}

func TestCacheServesTheReportOnceBuilt(t *testing.T) {
	var calls atomic.Int32

	resetCache(t, func(_ context.Context, start, _ time.Time, _ time.Duration) (map[string][]aws.MetricPoint, error) {
		calls.Add(1)
		return map[string][]aws.MetricPoint{"a": {{Timestamp: start, Value: 1}}}, nil
	})

	for _, err := range askAtOnce(5) {
		assert.NoError(t, err)
	}

	assert.Equal(t, int32(1), calls.Load(), "the report should be read once and then served from memory")
	assert.Len(t, cachedReport.Load().Applications, 1)
}

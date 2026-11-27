package appstatusstore

import (
	"context"
	"time"

	"github.com/DaviTelelaudo/all-might/internal/platform/aws"
)

// The metric every background application publishes every 5 minutes (see
// test/localstack/application_metrics.py for the simulated one).
const (
	namespace  = "monitor_de_aplicacoes"
	metricName = "ExecucaoNoPrazo"
	dimension  = "Aplicacao"
)

// GetExecutions returns, per application, the Maximum of ExecucaoNoPrazo for
// every period between start and end. Applications are discovered from the
// metric itself, so a new one appears without a code change.
func GetExecutions(ctx context.Context, start, end time.Time, period time.Duration) (map[string][]aws.MetricPoint, error) {
	applications, err := aws.ListDimensionValues(ctx, namespace, metricName, dimension)

	if err != nil {
		return nil, err
	}

	return aws.GetMetricMaximum(ctx, namespace, metricName, dimension, applications, start, end, period)
}

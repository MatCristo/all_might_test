package aws

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"
)

// GetMetricData accepts at most 500 queries per call.
const maxQueriesPerCall = 500

// MetricPoint is one value of a CloudWatch metric, already aggregated over a
// period (the timestamp is the start of that period).
type MetricPoint struct {
	Timestamp time.Time
	Value     float64
}

// ListDimensionValues returns every value of `dimension` that published
// `metricName` recently — for us, the name of every application that reports
// the metric. CloudWatch keeps a metric listed for two weeks after its last
// point, so an application that stopped publishing still shows up.
func ListDimensionValues(ctx context.Context, namespace, metricName, dimension string) ([]string, error) {
	paginator := cloudwatch.NewListMetricsPaginator(awsService.cloudwatchClient, &cloudwatch.ListMetricsInput{
		Namespace:  aws.String(namespace),
		MetricName: aws.String(metricName),
	})

	seen := map[string]bool{}
	values := []string{}

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)

		if err != nil {
			return nil, err
		}

		for _, metric := range page.Metrics {
			for _, d := range metric.Dimensions {
				if aws.ToString(d.Name) == dimension && !seen[aws.ToString(d.Value)] {
					seen[aws.ToString(d.Value)] = true
					values = append(values, aws.ToString(d.Value))
				}
			}
		}
	}

	return values, nil
}

// GetMetricMaximum reads `metricName` for each value of `dimension`, as the
// Maximum of every `period` between start and end — the same view as the AWS
// console dashboard. A period with no data has no point at all.
func GetMetricMaximum(ctx context.Context, namespace, metricName, dimension string, dimensionValues []string,
	start, end time.Time, period time.Duration) (map[string][]MetricPoint, error) {

	result := make(map[string][]MetricPoint, len(dimensionValues))

	for first := 0; first < len(dimensionValues); first += maxQueriesPerCall {
		last := min(first+maxQueriesPerCall, len(dimensionValues))
		batch := dimensionValues[first:last]

		// Query ids must be unique and start with a lowercase letter, so each
		// value gets "m<index>" and is mapped back from it below.
		queries := make([]types.MetricDataQuery, 0, len(batch))
		valueByQueryId := make(map[string]string, len(batch))

		for i, value := range batch {
			id := fmt.Sprintf("m%d", i)
			valueByQueryId[id] = value

			queries = append(queries, types.MetricDataQuery{
				Id: aws.String(id),
				MetricStat: &types.MetricStat{
					Metric: &types.Metric{
						Namespace:  aws.String(namespace),
						MetricName: aws.String(metricName),
						Dimensions: []types.Dimension{{Name: aws.String(dimension), Value: aws.String(value)}},
					},
					Period: aws.Int32(int32(period.Seconds())),
					Stat:   aws.String("Maximum"),
				},
			})

			result[value] = []MetricPoint{}
		}

		paginator := cloudwatch.NewGetMetricDataPaginator(awsService.cloudwatchClient, &cloudwatch.GetMetricDataInput{
			MetricDataQueries: queries,
			StartTime:         aws.Time(start),
			EndTime:           aws.Time(end),
		})

		for paginator.HasMorePages() {
			page, err := paginator.NextPage(ctx)

			if err != nil {
				return nil, err
			}

			for _, series := range page.MetricDataResults {
				value := valueByQueryId[aws.ToString(series.Id)]

				for i := range series.Timestamps {
					result[value] = append(result[value], MetricPoint{
						Timestamp: series.Timestamps[i],
						Value:     series.Values[i],
					})
				}
			}
		}
	}

	return result, nil
}

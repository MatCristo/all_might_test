package aws

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"
)

const (
	logGroup = "/all_might"
	// logRetentionDays caps how long log events live so the group doesn't grow
	// (and bill) forever. Log groups never expire by default.
	logRetentionDays = 90
)

var (
	// logStream is unique to this running instance so that concurrent ECS tasks
	// never interleave writes into the same stream.
	logStream     = buildLogStreamName()
	logStreamOnce sync.Once
)

// buildLogStreamName builds a per-instance stream name (hostname + start time).
// On ECS the hostname is the container ID, which keeps every task separate.
func buildLogStreamName() string {
	host, err := os.Hostname()
	if err != nil || host == "" {
		host = "unknown-host"
	}
	return fmt.Sprintf("%s-%s", host, time.Now().UTC().Format("2006-01-02T15-04-05Z"))
}

// ensureLogStream lazily provisions this instance's log stream exactly once:
// it makes sure the group exists, sets a retention policy, and creates the
// stream. Everything is best-effort — failures are reported but never fatal,
// since logging must not break the request path.
func ensureLogStream(ctx context.Context) {
	logStreamOnce.Do(func() {
		// Create the group if it isn't there yet (idempotent).
		_, err := awsService.cloudwatchLogsClient.CreateLogGroup(ctx, &cloudwatchlogs.CreateLogGroupInput{
			LogGroupName: aws.String(logGroup),
		})
		if err != nil && !isAlreadyExists(err) {
			fmt.Println("Error creating CloudWatch log group:", err.Error())
		}

		// Best-effort retention so logs don't accumulate indefinitely.
		_, err = awsService.cloudwatchLogsClient.PutRetentionPolicy(ctx, &cloudwatchlogs.PutRetentionPolicyInput{
			LogGroupName:    aws.String(logGroup),
			RetentionInDays: aws.Int32(logRetentionDays),
		})
		if err != nil {
			fmt.Println("Error setting CloudWatch log retention:", err.Error())
		}

		// Create this instance's stream (idempotent).
		_, err = awsService.cloudwatchLogsClient.CreateLogStream(ctx, &cloudwatchlogs.CreateLogStreamInput{
			LogGroupName:  aws.String(logGroup),
			LogStreamName: aws.String(logStream),
		})
		if err != nil && !isAlreadyExists(err) {
			fmt.Println("Error creating CloudWatch log stream:", err.Error())
		}
	})
}

// isAlreadyExists reports whether err is CloudWatch Logs' "already exists"
// error, which is a benign no-op for our idempotent create calls.
func isAlreadyExists(err error) bool {
	var exists *types.ResourceAlreadyExistsException
	return errors.As(err, &exists)
}

func RegisterLog(errorOrigin, errorMessage string) error {
	ctx := context.TODO()
	ensureLogStream(ctx)

	// Create the log event
	event := types.InputLogEvent{
		Message:   aws.String(fmt.Sprintf("[ORIGIN] %s [ERROR] %s", errorOrigin, errorMessage)),
		Timestamp: aws.Int64(time.Now().UnixNano() / int64(time.Millisecond)),
	}

	// Send to AWS
	_, err := awsService.cloudwatchLogsClient.PutLogEvents(ctx, &cloudwatchlogs.PutLogEventsInput{
		LogEvents:     []types.InputLogEvent{event},
		LogGroupName:  aws.String(logGroup),
		LogStreamName: aws.String(logStream),
	})

	if err != nil {
		fmt.Println("Error sending log to AWS CloudWatch:", err.Error())
	}

	return err
}

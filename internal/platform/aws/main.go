package aws

import (
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

type AWS struct {
	secretsManagerClient *secretsmanager.Client
	cloudwatchLogsClient *cloudwatchlogs.Client
	jsonAllMight         map[string]interface{}
}

var awsService AWS

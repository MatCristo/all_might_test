package aws

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

// Every AWS client points at LocalStack (see docker-compose.yaml and
// test/localstack/config_localstack.py). Its certificate is self-signed.
const (
	localStackEndpoint = "https://localhost.localstack.cloud:4566"
	region             = "us-east-1"
)

func Init() error {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithHTTPClient(&http.Client{Transport: transport}),
		config.WithRegion(region),
	)

	if err != nil {
		return err
	}

	endpoint := localStackEndpoint

	awsService.secretsManagerClient = secretsmanager.NewFromConfig(cfg, func(o *secretsmanager.Options) {
		o.BaseEndpoint = &endpoint
	})

	awsService.cloudwatchLogsClient = cloudwatchlogs.NewFromConfig(cfg, func(o *cloudwatchlogs.Options) {
		o.BaseEndpoint = &endpoint
	})

	awsService.cloudwatchClient = cloudwatch.NewFromConfig(cfg, func(o *cloudwatch.Options) {
		o.BaseEndpoint = &endpoint
	})

	secretJson, err := GetSecretsManagerParam("allMightJson")

	if err != nil {
		return err
	}

	var data map[string]interface{}
	err = json.Unmarshal([]byte(*secretJson), &data)

	if err != nil {
		return err
	}

	awsService.jsonAllMight = data

	return nil
}

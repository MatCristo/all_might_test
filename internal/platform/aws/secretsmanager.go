package aws

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

func GetSecretsManagerParam(paramName string) (*string, error) {
	secretValue, err := awsService.secretsManagerClient.GetSecretValue(context.TODO(),
		&secretsmanager.GetSecretValueInput{
			SecretId: aws.String(paramName),
		})

	if err != nil {
		return nil, err
	}

	return secretValue.SecretString, nil
}

func GetParamFromJson(paramName string) (*string, error) {
	val, exists := awsService.jsonAllMight[paramName]
	if !exists {
		return nil, fmt.Errorf("key '%s' not found in JSON", paramName)
	}

	var strVal string
	ok := true

	switch v := val.(type) {
	case string:
		strVal = v
	case map[string]interface{}:
		jsonBytes, err := json.Marshal(v)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal value: %v", err)
		}
		strVal = string(jsonBytes)
	default:
		ok = false
	}

	if !ok {
		return nil, fmt.Errorf("value for key '%s' is not a string", paramName)
	}

	return &strVal, nil
}

func GetParamsFromJson(paramNames []string) (map[string]string, error) {
	paramValues := make(map[string]string)

	for _, paramName := range paramNames {
		paramValue, err := GetParamFromJson(paramName)

		if err != nil {
			return nil, err
		}

		paramValues[paramName] = *paramValue
	}

	return paramValues, nil
}

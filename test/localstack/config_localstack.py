import boto3

region = "us-east-1"
endpoint_url = "https://localhost.localstack.cloud:4566"
creds = {"aws_access_key_id": "test", "aws_secret_access_key": "test"}

secretsmanager_client = boto3.client(
    "secretsmanager",
    region_name="us-east-1",
    endpoint_url=f"https://localhost.localstack.cloud:4566",
    aws_access_key_id="test",
    aws_secret_access_key="test",
    verify=False
)

secretsmanager_client.create_secret(
    Name='allMightJson',
    SecretString='{ ' \
    '"RDS_CLINUX_DB_NAME": "test", ' \
    '"RDS_CLINUX_HOST": "test_db", ' \
    '"RDS_CLINUX_USR": "postgresuser", ' \
    '"RDS_CLINUX_PWD": "postgresPassword", ' \
    '"RDS_TIAPPLICATIONS_DB_NAME": "ti_applications", ' \
    '"RDS_TIAPPLICATIONS_HOST": "test_db", ' \
    '"RDS_TIAPPLICATIONS_USR": "postgresuser", ' \
    '"RDS_TIAPPLICATIONS_PWD": "postgresPassword",' \
    '"TokenHashSecret": "test-only-4d9271253572be37ab07d48f0baf6c2d35c7cd498b491a7a"}' \
)

logs_client = boto3.client("logs", region_name=region, endpoint_url=endpoint_url, **creds)

log_group_name = "/all_might"
log_stream_name = "error-stream"

try:
    # 2. Create the Log Group
    logs_client.create_log_group(logGroupName=log_group_name)
    print(f"Log Group '{log_group_name}' created.")
except logs_client.exceptions.ResourceAlreadyExistsException:
    print(f"Log Group '{log_group_name}' already exists.")

try:
    # 3. Create the Log Stream
    logs_client.create_log_stream(logGroupName=log_group_name, logStreamName=log_stream_name)
    print(f"Log Stream '{log_stream_name}' created.")
except logs_client.exceptions.ResourceAlreadyExistsException:
    print(f"Log Stream '{log_stream_name}' already exists.")

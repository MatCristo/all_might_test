import boto3
from datetime import datetime, timedelta, timezone

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


# ---------------------------------------------------------------------------
# Application status metric (the "Status das aplicações" page)
#
# In production every background application publishes, every 5 minutes, the
# metric ExecucaoNoPrazo: 1 when its last run finished on time, 0 when it did
# not. LocalStack starts empty, so we seed the last 7 days here, with one
# scenario per situation the page has to show: failing now, recovered, no data
# now, an old gap and flapping.
#
# The data is relative to the moment LocalStack starts. To get a fresh "now",
# restart it: docker compose restart localstack
# ---------------------------------------------------------------------------

METRIC_NAMESPACE = "monitor_de_aplicacoes"
METRIC_NAME = "ExecucaoNoPrazo"
METRIC_DIMENSION = "Aplicacao"

APPLICATIONS = [
    "Clean-zip",
    "clinuxsend",
    "critical-notifier",
    "eleva-integration",
    "notificar-revisao",
    "notify_comments",
    "notify-hearp",
    "storelts",
    "tdcm2kit-tdcmrm",
    "incremental_anonimizer",
]

PERIOD_MINUTES = 5
DAYS = 7
HOUR = 60
DAY = 24 * HOUR


def value_at(app, minutes_ago):
    """The value an application published `minutes_ago` minutes before now:
    1 (on time), 0 (late or failed) or None (it published nothing)."""

    # Failing now: every run of the last 3 hours was late.
    if app == "storelts":
        return 0 if minutes_ago < 3 * HOUR else 1

    # Recovered: failed for 12 hours two days ago, fine since then.
    if app == "clinuxsend":
        return 0 if 2 * DAY <= minutes_ago < 2 * DAY + 12 * HOUR else 1

    # No data now: stopped publishing 1 hour ago (crashed, or cannot report).
    if app == "critical-notifier":
        return None if minutes_ago < HOUR else 1

    # Old gap: published nothing for 6 hours four days ago, fine now.
    if app == "eleva-integration":
        return None if 4 * DAY <= minutes_ago < 4 * DAY + 6 * HOUR else 1

    # Flapping: one late run every 8 hours, recovering on the next one.
    if app == "notify-hearp":
        return 0 if minutes_ago % (8 * HOUR) == 4 * HOUR else 1

    # Every other application is healthy the whole week.
    return 1


def seed_application_metrics():
    cloudwatch_client = boto3.client("cloudwatch", region_name=region, endpoint_url=endpoint_url, **creds)

    # Align "now" to a 5-minute boundary, like the real metric's periods.
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    now -= timedelta(minutes=now.minute % PERIOD_MINUTES)

    for app in APPLICATIONS:
        points = []

        for minutes_ago in range(0, DAYS * DAY, PERIOD_MINUTES):
            value = value_at(app, minutes_ago)

            if value is None:
                continue  # a gap: nothing was published at this moment

            points.append({
                "MetricName": METRIC_NAME,
                "Dimensions": [{"Name": METRIC_DIMENSION, "Value": app}],
                "Timestamp": now - timedelta(minutes=minutes_ago),
                "Value": float(value),
            })

        # PutMetricData accepts at most 1000 points per call.
        for start in range(0, len(points), 500):
            cloudwatch_client.put_metric_data(Namespace=METRIC_NAMESPACE, MetricData=points[start:start + 500])

        print(f"Metric {METRIC_NAME} seeded for '{app}': {len(points)} points.")


seed_application_metrics()

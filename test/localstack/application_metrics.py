"""
Simulates the metric behind the "Status das aplicações" page.

In production every background application publishes, every 5 minutes, the
metric ExecucaoNoPrazo: 1 when its last run finished on time, 0 when it did
not. LocalStack starts empty, so this script plays the applications' part:

1. seeds the last 8 days (one more than the page shows, so its 7-day window
   is always fully covered), one point per 5 minutes per application;
2. keeps publishing a new point every 5 minutes, so "now" never goes stale.

Each application follows one scenario — failing now, recovered, no data now,
an old gap, flapping or healthy — so the page has every situation to show.

config_localstack.py starts it in the background when LocalStack is ready.
"""

import time
from datetime import datetime, timedelta, timezone

import boto3

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
HISTORY_DAYS = 8
HOUR = 60
DAY = 24 * HOUR

cloudwatch_client = boto3.client(
    "cloudwatch",
    region_name="us-east-1",
    endpoint_url="https://localhost.localstack.cloud:4566",
    aws_access_key_id="test",
    aws_secret_access_key="test",
)


def value_at(app, minutes_ago):
    """The value an application published `minutes_ago` minutes before the
    simulation started: 1 (on time), 0 (late or failed) or None (it published
    nothing). After the start minutes_ago is negative, and every scenario
    simply carries on: storelts keeps failing, critical-notifier stays silent."""

    # Failing now: every run since 3 hours before the start was late.
    if app == "storelts":
        return 0 if minutes_ago < 3 * HOUR else 1

    # Recovered: failed for 12 hours two days ago, fine since then.
    if app == "clinuxsend":
        return 0 if 2 * DAY <= minutes_ago < 2 * DAY + 12 * HOUR else 1

    # No data now: stopped publishing 1 hour before the start (crashed, or
    # cannot report).
    if app == "critical-notifier":
        return None if minutes_ago < HOUR else 1

    # Old gap: published nothing for 6 hours four days ago, fine now.
    if app == "eleva-integration":
        return None if 4 * DAY <= minutes_ago < 4 * DAY + 6 * HOUR else 1

    # Flapping: one late run every 8 hours, recovering on the next one.
    if app == "notify-hearp":
        return 0 if minutes_ago % (8 * HOUR) == 4 * HOUR else 1

    # Every other application is healthy.
    return 1


def build_point(app, moment, value):
    return {
        "MetricName": METRIC_NAME,
        "Dimensions": [{"Name": METRIC_DIMENSION, "Value": app}],
        "Timestamp": moment,
        "Value": float(value),
    }


def minutes_between(earlier, later):
    return int((later - earlier).total_seconds() // 60)


def seed_history(started_at):
    """Publishes the HISTORY_DAYS before started_at."""
    for app in APPLICATIONS:
        points = []

        for minutes_ago in range(0, HISTORY_DAYS * DAY, PERIOD_MINUTES):
            value = value_at(app, minutes_ago)

            if value is None:
                continue  # a gap: nothing was published at this moment

            points.append(build_point(app, started_at - timedelta(minutes=minutes_ago), value))

        # PutMetricData accepts at most 1000 points per call.
        for start in range(0, len(points), 500):
            cloudwatch_client.put_metric_data(Namespace=METRIC_NAMESPACE, MetricData=points[start:start + 500])

        print(f"Metric {METRIC_NAME} seeded for '{app}': {len(points)} points.", flush=True)


def publish_forever(started_at):
    """Every 5 minutes, publishes what each application would report now."""
    moment = started_at

    while True:
        moment += timedelta(minutes=PERIOD_MINUTES)

        # Sleep until that moment arrives.
        time.sleep(max(0, (moment - datetime.now(timezone.utc)).total_seconds()))

        minutes_ago = -minutes_between(started_at, moment)
        points = []

        for app in APPLICATIONS:
            value = value_at(app, minutes_ago)

            if value is not None:
                points.append(build_point(app, moment, value))

        try:
            cloudwatch_client.put_metric_data(Namespace=METRIC_NAMESPACE, MetricData=points)
        except Exception as error:  # keep the simulation alive through a hiccup
            print(f"Could not publish {METRIC_NAME} at {moment}: {error}", flush=True)


def main():
    # Aligned to a 5-minute boundary, like the real metric's periods.
    started_at = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    started_at -= timedelta(minutes=started_at.minute % PERIOD_MINUTES)

    seed_history(started_at)
    print(f"Metric {METRIC_NAME}: publishing every {PERIOD_MINUTES} minutes from now on.", flush=True)
    publish_forever(started_at)


if __name__ == "__main__":
    main()

import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { DataForgeEnvironment, resourceName } from '../lib/config';
import { StreamingStack } from './streaming-stack';

export interface MonitoringStackProps extends cdk.StackProps {
  readonly forgeEnv: DataForgeEnvironment;
  readonly streaming: StreamingStack;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);
    const { forgeEnv, streaming } = props;

    this.alertTopic = new sns.Topic(this, 'Alerts', {
      topicName: resourceName(forgeEnv.name, 'anomalies'),
      displayName: 'DataForge anomaly alerts',
    });
    if (forgeEnv.notifyEmail) {
      this.alertTopic.addSubscription(new subscriptions.EmailSubscription(forgeEnv.notifyEmail));
    }

    const iteratorAge = streaming.stream.metricGetRecordsIteratorAgeMilliseconds({ period: cdk.Duration.minutes(1) });
    const incoming = streaming.stream.metricIncomingRecords({ period: cdk.Duration.minutes(1) });

    const lagAlarm = new cloudwatch.Alarm(this, 'IteratorAge', {
      alarmName: resourceName(forgeEnv.name, 'iterator-age'),
      metric: iteratorAge,
      threshold: 60_000,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    lagAlarm.addAlarmAction(new cw_actions.SnsAction(this.alertTopic));

    const detector = new NodejsFunction(this, 'AnomalyDetector', {
      functionName: resourceName(forgeEnv.name, 'anomaly'),
      entry: path.join(__dirname, '..', '..', 'services', 'anomaly-detector', 'handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STREAM_NAME: streaming.stream.streamName,
        ALERT_TOPIC_ARN: this.alertTopic.topicArn,
      },
      bundling: { minify: true, sourceMap: true, externalModules: ['@aws-sdk/*'] },
    });
    this.alertTopic.grantPublish(detector);
    detector.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cloudwatch:GetMetricStatistics'],
        resources: ['*'],
      }),
    );

    new events.Rule(this, 'AnomalySchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(detector)],
    });

    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `DataForge-${forgeEnv.name}`,
    });
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({ title: 'Incoming records', left: [incoming], width: 12 }),
      new cloudwatch.GraphWidget({ title: 'Iterator age (ms)', left: [iteratorAge], width: 12 }),
    );

    new cdk.CfnOutput(this, 'AlertTopicArn', { value: this.alertTopic.topicArn });
  }
}

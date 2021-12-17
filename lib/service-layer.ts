import {Construct, Duration} from "@aws-cdk/core";
import {NetworkLayer} from "./network-layer";
import {DataLayer} from "./data-layer";
import {ContainerImage, IBaseService} from "@aws-cdk/aws-ecs";
import {DockerImageAsset} from "@aws-cdk/aws-ecr-assets";
import {ApplicationLoadBalancedFargateService} from "@aws-cdk/aws-ecs-patterns";
import {DnsValidatedCertificate} from "@aws-cdk/aws-certificatemanager";
import {Repository} from "@aws-cdk/aws-ecr";
import {HostedZone} from "@aws-cdk/aws-route53";

interface ServiceLayerProps {
    networkLayer: NetworkLayer,
    dataLayer: DataLayer
}

export class ServiceLayer extends Construct {
    public readonly service: IBaseService;
    public readonly containerName: string;
    public readonly ecrRepo: Repository;

    public readonly repoName: string;

    constructor(scope: Construct, id: string, props: ServiceLayerProps) {
        super(scope, id);

        // Import network and data resources
        const cluster = props.networkLayer.cluster;
        const db = props.dataLayer.dbCluster;
        const dbUrl = props.dataLayer.dbUrl;
        const redisHost = props.dataLayer.redisHost;

        const asset = new DockerImageAsset(this, 'ImageAssetBuild', {
            directory: '../{TEMPLATE_APP_NAME}'
        });

        // compute repo name from asset image
        const parts = asset.imageUri.split("@")[0].split("/");
        this.repoName = parts.slice(1, parts.length).join("/").split(":")[0];

        const image = ContainerImage.fromDockerImageAsset(asset);

        const zoneName = '{TEMPLATE_AWS_ZONE_NAME}'
        const domainZone = HostedZone.fromLookup(this, 'StagingZone', { domainName : zoneName });
        const domainName = `{TEMPLATE_SERVICE_HYPHEN_NAME}.${domainZone.zoneName}`;
        const certificate = new DnsValidatedCertificate(this, 'Certificate', {
            domainName,
            hostedZone: domainZone
        });

        // Load balanced fargate service
        const lbFargateService = new ApplicationLoadBalancedFargateService(this, 'LBFargate', {
            serviceName: '{TEMPLATE_SERVICE_NAME}',
            cluster: cluster,
            taskImageOptions: {
                image: image,
                containerName: 'FargateTaskContainer',
                containerPort: 80,
                environment: {
                    'RAILS_ENV': 'production',
                    'REDIS_HOST': redisHost,
                    'DATABASE_URL': dbUrl,
                    'SECRET_KEY_BASE': 'production_test_key' // TODO: Fix this
                },
                enableLogging: true,
            },
            domainName,
            domainZone,
            certificate,
            memoryLimitMiB: 512,
            cpu: 256,
            desiredCount: 1,
            publicLoadBalancer: true,
            assignPublicIp: true
        });

        // Set health check path for rails app
        lbFargateService.targetGroup.configureHealthCheck({
            path: '/health',
            healthyThresholdCount: 2,
            unhealthyThresholdCount: 10,
            interval: Duration.seconds(10),
            timeout: Duration.seconds(5),
        });
        lbFargateService.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '5')

        db.connections.allowDefaultPortFrom(lbFargateService.service, 'From Fargate');
        this.service = lbFargateService.service;
        this.containerName = lbFargateService.taskDefinition.defaultContainer!.containerName;

        this.ecrRepo = new Repository(this, 'Repo');
        this.ecrRepo.grantPull(lbFargateService.taskDefinition.executionRole!);
    }
}
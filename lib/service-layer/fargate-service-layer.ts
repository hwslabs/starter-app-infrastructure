import {Construct, Duration} from "@aws-cdk/core";
import {Cluster, ContainerImage, IBaseService} from "@aws-cdk/aws-ecs";
import {DockerImageAsset} from "@aws-cdk/aws-ecr-assets";
import {ApplicationLoadBalancedFargateService} from "@aws-cdk/aws-ecs-patterns";
import {Repository} from "@aws-cdk/aws-ecr";
import {ServiceLayer, ServiceLayerProps} from "./service-layer";
import {ApplicationProtocol, ApplicationProtocolVersion} from "@aws-cdk/aws-elasticloadbalancingv2";

export class FargateServiceLayer extends ServiceLayer {
    public readonly service: IBaseService;
    public readonly containerName: string;
    public readonly ecrRepo: Repository;
    public readonly lbFargateService: ApplicationLoadBalancedFargateService;

    constructor(scope: Construct, id: string, props: ServiceLayerProps) {
        super(scope, id, props);

        interface Environment {
            /**
             * The environment variables to pass to the container.
             *
             * @default - No environment variables.
             * @stability stable
             */
            [key: string]: string;
        }
        let environment: Environment = {}
        if(props.service.framework == 'Rails') {
            environment['RAILS_ENV'] = 'production';
            environment['SECRET_KEY_BASE'] = 'production_test_key';

            if (props.cacheConf == 'Redis') {
                environment['REDIS_HOST'] = props.dataLayer.redisHost;
            }
            if (props.dbConf == 'Aurora') {
                environment['DATABASE_URL'] = props.dataLayer.dbUrl;
            }
        }
        this.ecrRepo = new Repository(this, 'Repo');

        const cluster = new Cluster(this, 'ECSCluster', {vpc: props.networkLayer.vpc});

        const asset = new DockerImageAsset(this, 'ImageAssetBuild', {
            directory: props.service.directory
        });
        const image = ContainerImage.fromDockerImageAsset(asset);

        // Load balanced fargate service
        if(props.service.framework == 'HTTP') {
            this.lbFargateService = new ApplicationLoadBalancedFargateService(this, 'AlbFargateHTTP', {
                serviceName: props.service.name,
                cluster,
                domainName: this.endpoint,
                domainZone: this.domainZone,
                certificate: this.certificate,
                memoryLimitMiB: 512,
                cpu: 256,
                protocol: ApplicationProtocol.HTTPS,
                targetProtocol: ApplicationProtocol.HTTP,
                protocolVersion: ApplicationProtocolVersion.HTTP1,
                desiredCount: 1,
                publicLoadBalancer: true,
                assignPublicIp: true,
                listenerPort: 443,
                taskImageOptions: {
                    image: image,
                    containerName: 'FargateTaskContainer',
                    containerPort: 80,
                    environment,
                    enableLogging: true
                }
            });

            // Set dedicated health check path for HTTP server
            this.lbFargateService.targetGroup.configureHealthCheck({
                path: '/health',
                healthyThresholdCount: 2,
                unhealthyThresholdCount: 10,
                interval: Duration.seconds(10),
                timeout: Duration.seconds(5),
            });
        } else if (props.service.framework == 'GRPC') {
            this.lbFargateService = new ApplicationLoadBalancedFargateService(this, "AlbFargateGRPC", {
                serviceName: props.service.name,
                cluster,
                domainName: this.endpoint,
                domainZone: this.domainZone,
                certificate: this.certificate,
                memoryLimitMiB: 512,
                cpu: 256,
                protocol: ApplicationProtocol.HTTPS,
                targetProtocol: ApplicationProtocol.HTTP,
                protocolVersion: ApplicationProtocolVersion.GRPC,
                desiredCount: 1,
                publicLoadBalancer: true,
                assignPublicIp: true,
                listenerPort: 50051,
                taskImageOptions: {
                    image: image,
                    containerName: 'FargateTaskContainer',
                    containerPort: 50051,
                    environment,
                    enableLogging: true
                }
            });
        } else {
            throw new TypeError(`Invalid framework type ${props.service.framework}`)
        }

        this.lbFargateService.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '5')

        if (props.dbConf == 'Aurora') {
            props.dataLayer.dbCluster.connections.allowDefaultPortFrom(this.lbFargateService.service, 'From Fargate');
        }
        this.service = this.lbFargateService.service;
        this.containerName = this.lbFargateService.taskDefinition.defaultContainer!.containerName;
        this.ecrRepo.grantPull(this.lbFargateService.taskDefinition.executionRole!);

        // Enable autoscaling
        const autoScalingGroup = this.lbFargateService.service.autoScaleTaskCount({
            minCapacity: 1,
            maxCapacity: 3
        });
        autoScalingGroup.scaleOnCpuUtilization('CpuScaling', {
            targetUtilizationPercent: 80,
            scaleInCooldown: Duration.seconds(60),
            scaleOutCooldown: Duration.seconds(60),
        });
    }
}
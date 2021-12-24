import {ServiceLayer, ServiceLayerProps} from "./service-layer";
import {AutoScalingGroup, HealthCheck} from "@aws-cdk/aws-autoscaling";
import {ApplicationLoadBalancer, ApplicationTargetGroup} from "@aws-cdk/aws-elasticloadbalancingv2";
import {Construct, Duration} from "@aws-cdk/core";
import {
    AmazonLinuxGeneration,
    InstanceClass,
    InstanceSize,
    InstanceType,
    MachineImage,
    Peer,
    Port,
    SecurityGroup, SubnetType,
    UserData
} from "@aws-cdk/aws-ec2";
import {readFileSync} from "fs";
import {replaceAllSubstrings} from "../utils";
import {ARecord, RecordTarget} from "@aws-cdk/aws-route53";
import {LoadBalancerTarget} from "@aws-cdk/aws-route53-targets";

export class Ec2ServiceLayer extends ServiceLayer {
    public readonly asg: AutoScalingGroup;
    public readonly albTargetGroup: ApplicationTargetGroup;

    constructor(scope: Construct, id: string, props: ServiceLayerProps) {
        super(scope, id, props);

        const vpc = props.networkLayer.vpc;

        // Create a security group for the instances
        const securityGroup = new SecurityGroup(
            scope,
            'InstancesSecurityGroup',
            {
                vpc: vpc,
                allowAllOutbound: true,
                securityGroupName: 'service-instances-sg',
            }
        );

        securityGroup.addIngressRule(
            Peer.ipv4(vpc.vpcCidrBlock),
            Port.tcp(80),
            'Allows HTTP access from resources inside our VPC (like the ALB)'
        );

        // Fetch the user script from file system as a string
        const userScript = readFileSync('lib/scripts/install.sh', 'utf8');

        const wordsArray: Array<Record<string, string>> = [
            { _RAILS_ENV: 'production'},
            { _SECRET_KEY_BASE: 'production_test_key'}
        ]

        if(props.cacheConf == 'Redis') {
            wordsArray.push({ _REDIS_HOST: props.dataLayer.redisHost })
        }
        if(props.dbConf == 'Aurora') {
            wordsArray.push({ _DATABASE_URL: props.dataLayer.dbUrl })
        }

        // Replace environment variable values in userScript
        const updatedUserScript = replaceAllSubstrings(wordsArray, userScript);

        // Create an autoscaling group
        this.asg = new AutoScalingGroup(scope, 'AutoScalingGroup', {
            vpc: vpc,
            instanceType: InstanceType.of(
                InstanceClass.C4,
                InstanceSize.LARGE
            ),
            // blockDevices: [
            //     {
            //         deviceName : "/dev/xvdf",
            //         volume : BlockDeviceVolume.ebs(100)
            //     }
            // ],
            keyName: 'builder-hub-key-pair',
            machineImage: MachineImage.latestAmazonLinux({
                generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
            }),
            userData: UserData.custom(updatedUserScript),
            // we only want one instance in our ASG
            minCapacity: 1,
            maxCapacity: 1,
            associatePublicIpAddress: true,
            vpcSubnets: { subnetType: SubnetType.PUBLIC },
            healthCheck: HealthCheck.ec2()
        });

        const alb = new ApplicationLoadBalancer(scope, 'ApplicationLoadBalancer', {
            loadBalancerName: 'service-alb',
            vpc,
            internetFacing: true,
        });

        // we will  need the listener to add our autoscaling group later
        const httpsListener = alb.addListener(`AlbListener`, {
            port: 443,
            open: true,
            certificates: [this.certificate]
        })

        // Add autoscaling group to load balancer
        this.albTargetGroup = httpsListener.addTargets(`AlbTargetAsg`, {
            port: 80,
            targets: [this.asg],
            healthCheck: {
                path: '/health',
                healthyThresholdCount: 2,
                unhealthyThresholdCount: 10,
                interval: Duration.seconds(10),
                timeout: Duration.seconds(5),
            },
            deregistrationDelay: Duration.seconds(5)
        })

        new ARecord(this, 'AliasRecord', {
            target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
            zone: this.domainZone,
            recordName: this.subDomain,
        });
    }
}
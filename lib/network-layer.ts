import {Construct} from "@aws-cdk/core";
import {IVpc, SubnetType, Vpc} from "@aws-cdk/aws-ec2";
import {Cluster, ICluster} from "@aws-cdk/aws-ecs";

export class NetworkLayer extends Construct {
    public readonly vpc: IVpc;
    public readonly cluster: ICluster;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        // Setting up VPC with subnets
        const vpc = new Vpc(this, 'Vpc', {
            maxAzs: 2,
            cidr: '10.0.0.0/21',
            enableDnsSupport: true,
            natGateways: 2,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'application',
                    subnetType: SubnetType.PRIVATE_ISOLATED
                },
                {
                    cidrMask: 24,
                    name: 'ingress',
                    subnetType: SubnetType.PUBLIC
                },
                {
                    cidrMask: 28,
                    name: 'database',
                    subnetType: SubnetType.PRIVATE_ISOLATED
                },
            ]
        });
        this.vpc = vpc;

        this.cluster = new Cluster(this, 'ECSCluster', { vpc });
    }
}
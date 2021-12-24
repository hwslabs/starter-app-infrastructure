import {Construct} from "@aws-cdk/core";
import {IVpc, SubnetType, Vpc} from "@aws-cdk/aws-ec2";
import {Infrastructure} from "./configurations/infra";

interface NetworkLayerProps {
    conf: Infrastructure
}

export class NetworkLayer extends Construct {
    public readonly vpc: IVpc;

    constructor(scope: Construct, id: string, props: NetworkLayerProps) {
        super(scope, id);

        const conf = props.conf

        const natGateways = conf.nat == 'NAT' ? 1 : 0;

        // Setting up VPC with subnets
        this.vpc = new Vpc(this, 'Vpc', {
            maxAzs: 2,
            cidr: '10.0.0.0/21',
            enableDnsSupport: true,
            natGateways,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'application',
                    subnetType: SubnetType.PUBLIC
                },
                {
                    cidrMask: 28,
                    name: 'database',
                    subnetType: SubnetType.PRIVATE_ISOLATED
                },
            ]
        });
    }
}
import {Credentials, DatabaseCluster, DatabaseClusterEngine, ParameterGroup} from "@aws-cdk/aws-rds";
import {Construct, RemovalPolicy, SecretValue} from "@aws-cdk/core";
import {NetworkLayer} from "./network-layer";
import {InstanceClass, InstanceSize, InstanceType, IVpc, Peer, Port, SecurityGroup, SubnetType} from "@aws-cdk/aws-ec2";
import {CfnReplicationGroup, CfnSubnetGroup} from "@aws-cdk/aws-elasticache";

interface DataLayerProps {
    networkLayer: NetworkLayer
}

export class DataLayer extends Construct {
    public readonly dbUrl: string;
    public readonly dbCluster: DatabaseCluster;
    public readonly redisHost: string;
    public readonly redisCluster: CfnReplicationGroup;

    constructor(scope: Construct, id: string, props: DataLayerProps) {
        super(scope, id);

        // Import network resources
        const vpc = props.networkLayer.vpc;

        // Create redis cluster
        const redisParams = this.createRedisCluster(vpc);

        // Create DB cluster
        const dbParams = this.createDbCluster(vpc);

        this.redisCluster = redisParams.redisCluster;
        this.redisHost = redisParams.redisUrl;
        this.dbCluster = dbParams.dbCluster;
        this.dbUrl = dbParams.dbUrl;
    }

    private createRedisCluster(vpc: IVpc) {
        //Create redis cache cluster
        const redisSecurityGroup: SecurityGroup = new SecurityGroup(this, 'SecurityGroup', {
            vpc
        });
        const subnetGroup: CfnSubnetGroup =
            new CfnSubnetGroup(this, 'SubnetGroup', {
                cacheSubnetGroupName: 'redis-subnet-group',
                description: `Subnets for redis cache`,
                subnetIds: vpc.selectSubnets({subnetName: 'application'}).subnetIds
            });
        redisSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(6379), 'Allow from all on port 6379');

        const redisCluster = new CfnReplicationGroup(this, 'Redis', {
            replicationGroupId: `redis-replication-group`,
            replicationGroupDescription: 'redis',
            cacheNodeType: 'cache.t2.micro',
            engine: 'redis',
            // cacheParameterGroupName: 'default.redis5.0',
            cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
            securityGroupIds: [redisSecurityGroup.securityGroupId],
            numCacheClusters: 1,
            automaticFailoverEnabled: false
        });
        redisCluster.addDependsOn(subnetGroup);
        const redisHost = redisCluster.attrPrimaryEndPointAddress
        return {redisCluster, redisUrl: redisHost};
    }

    private createDbCluster(vpc: IVpc) {
        // Create secret from SecretsManager
        const username = 'root';
        // Import password
        const password = SecretValue.secretsManager(`rds/cluster/${username}/password`);

        const databaseName = '{TEMPLATE_SERVICE_UNDERSCORE_NAME}';

        // Import DB cluster ParameterGroup
        const parameterGroup = ParameterGroup.fromParameterGroupName(
            this, 'DBClusterPG', 'default.aurora-postgresql12'
        );
        // Create DB Cluster
        const dbCluster = new DatabaseCluster(this, 'DBCluster', {
            engine: DatabaseClusterEngine.AURORA_POSTGRESQL,
            credentials: Credentials.fromPassword('root', password),
            instanceProps: {
                instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
                vpc: vpc,
                vpcSubnets: {
                    subnetType: SubnetType.PRIVATE_ISOLATED
                }
            },
            defaultDatabaseName: databaseName,
            removalPolicy: RemovalPolicy.DESTROY,
            instances: 1,
            parameterGroup: parameterGroup
        });
        const dbUrl = `postgres://${username}:${password}@${dbCluster.clusterEndpoint.socketAddress}/${databaseName}`;
        return {dbCluster, dbUrl};
    }
}
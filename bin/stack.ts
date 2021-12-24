import {App, CfnOutput, Construct, Stack, StackProps} from "@aws-cdk/core";
import {NetworkLayer} from "../lib/network-layer";
import {DataLayer} from "../lib/data-layer";
import {DeploymentLayer} from "../lib/deployment-layer";
import {ServiceFactory} from "../lib/service-layer/factory/service-factory";
import {Service} from "../lib/configurations/service";
import {Infrastructure} from "../lib/configurations/infra";
import {Database} from "../lib/configurations/database";
import {Cache} from "../lib/configurations/cache";
import {Deployment} from "../lib/configurations/deployment";

class CompleteStack extends Stack {

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const cache: Cache = {
            name: '{TEMPLATE_SERVICE_HYPHEN_NAME}',
            replicationId: '{TEMPLATE_SERVICE_HYPHEN_NAME}',
            clusterConfig: '{TEMPLATE_CACHE_CLUSTER}'
        }

        const database: Database = {
            name: '{TEMPLATE_SERVICE_UNDERSCORE_NAME}',
            clusterConfig: '{TEMPLATE_DB_CLUSTER}'
        }

        const service: Service = {
            name: '{TEMPLATE_SERVICE_HYPHEN_NAME}',
            protocol: '{TEMPLATE_SERVER_PROTOCOL}',
            server: '{TEMPLATE_SERVER_INFRA}',
            framework: '{TEMPLATE_SERVER_FRAMEWORK}',
            zoneName: '{TEMPLATE_AWS_ZONE_NAME}',
            endpoint: '{TEMPLATE_SERVICE_HYPHEN_NAME}.{TEMPLATE_AWS_ZONE_NAME}',
            directory: '../{TEMPLATE_SERVER_REPO_NAME}'
        }

        const deployment: Deployment = {
            deploymentConfig: '{TEMPLATE_DEPLOYMENT_INFRA}',
            // slackConfigId: '{TEMPLATE_SERVICE_NAME}',
            // slackConfigName: '{TEMPLATE_SERVICE_HYPHEN_NAME}'
        }

        const infraConfig : Infrastructure = {
            deployment,
            cache,
            database,
            service
        }

        const networkLayer = new NetworkLayer(this, 'NetworkLayer', { conf: infraConfig });
        const dataLayer = new DataLayer(this, 'DataLayer', {
            conf: infraConfig,
            networkLayer
        });

        const serviceFactory = ServiceFactory.instance(service);
        serviceFactory.serviceLayer(this, 'ServiceLayer', {
            service,
            networkLayer,
            dataLayer,
            cacheConf: infraConfig.cache.clusterConfig,
            dbConf: infraConfig.database.clusterConfig
        });

        new DeploymentLayer(this, 'CICDLayer', { serviceFactory, deployment });

        // Output the dns name of the endpoint
        new CfnOutput(scope, 'Endpoint', {
            value: infraConfig.service.endpoint,
        })
    }
}

const app = new App();
new CompleteStack(app, '{TEMPLATE_SERVICE_NAME}', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    }
});
app.synth();

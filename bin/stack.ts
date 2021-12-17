import {App, Construct, Stack, StackProps} from "@aws-cdk/core";
import {NetworkLayer} from "../lib/network-layer";
import {DataLayer} from "../lib/data-layer";
import {ServiceLayer} from "../lib/service-layer";
import {CICDLayer} from "../lib/cicd-layer";

class CompleteStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const networkLayer = new NetworkLayer(this, 'NetworkLayer');
        const dataLayer = new DataLayer(this, 'DataLayer', { networkLayer });
        const serviceLayer = new ServiceLayer(this, 'ServiceLayer', { networkLayer, dataLayer });
        new CICDLayer(this, 'CICDLayer', { serviceLayer });
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

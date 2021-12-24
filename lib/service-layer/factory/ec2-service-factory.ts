import {EnvironmentVariables, ServiceFactory} from "./service-factory";
import {ServiceLayer, ServiceLayerProps} from "../service-layer";
import {BuildSpec, Project} from "@aws-cdk/aws-codebuild";
import {Construct, Stack} from "@aws-cdk/core";
import {Artifact} from "@aws-cdk/aws-codepipeline";
import {Action} from "@aws-cdk/aws-codepipeline-actions/lib/action";
import {Ec2ServiceLayer} from "../ec2-service-layer";
import {LoadBalancer, ServerDeploymentGroup} from "@aws-cdk/aws-codedeploy";
import {CodeDeployServerDeployAction} from "@aws-cdk/aws-codepipeline-actions";
import {AutoScalingGroup} from "@aws-cdk/aws-autoscaling";
import {ApplicationTargetGroup} from "@aws-cdk/aws-elasticloadbalancingv2";

export class Ec2ServiceFactory extends ServiceFactory {
    ec2ServiceLayer: Ec2ServiceLayer
    asg: AutoScalingGroup;
    albTargetGroup: ApplicationTargetGroup;

    buildSpec(): BuildSpec {
        return BuildSpec.fromObject({
            version: '0.2',
            phases: {
                build: {
                    commands: [
                        'echo Build started on `date`',
                        'ls -la $CODEBUILD_SRC_DIR',
                        'echo Build completed on `date`'
                    ]
                }
            },
            artifacts: {
                files: [
                    '**/*'
                ]
            }
        });
    }

    deployAction(scope: Construct, buildOutput: Artifact): Action {
        const deploymentGroup = new ServerDeploymentGroup(scope, 'ServerDeploymentGroup',{
            deploymentGroupName: 'dep-group',
            autoScalingGroups: [this.asg],
            // Adds User Data that installs the CodeDeploy agent on your auto-scaling groups hosts
            installAgent: true,
            loadBalancer: LoadBalancer.application(this.albTargetGroup)
        });

        return new CodeDeployServerDeployAction({
            actionName: 'CodeDeploy',
            input: buildOutput,
            deploymentGroup,
            runOrder: 2
        });
    }

    environmentVariables(scope: Construct): EnvironmentVariables {
        return {
            AWS_ACCOUNT_ID: {
                value: Stack.of(scope).account
            },
            AWS_REGION: {
                value: Stack.of(scope).region
            }
        }
    }

    serviceLayer(scope: Construct, id: string, props: ServiceLayerProps): ServiceLayer {
        this.ec2ServiceLayer = new Ec2ServiceLayer(scope, id, props);

        this.asg = this.ec2ServiceLayer.asg;
        this.albTargetGroup = this.ec2ServiceLayer.albTargetGroup;

        return this.ec2ServiceLayer;
    }

    // @ts-ignore
    addProjectPermissions(project: Project) {
    }
}
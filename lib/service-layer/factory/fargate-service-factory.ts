import {EnvironmentVariables, ServiceFactory} from "./service-factory";
import {IBaseService} from "@aws-cdk/aws-ecs";
import {Repository} from "@aws-cdk/aws-ecr";
import {BuildSpec, Project} from "@aws-cdk/aws-codebuild";
import {ServiceLayer, ServiceLayerProps} from "../service-layer";
import {Construct, Stack} from "@aws-cdk/core";
import {FargateServiceLayer} from "../fargate-service-layer";
import {Artifact} from "@aws-cdk/aws-codepipeline";
import {Action} from "@aws-cdk/aws-codepipeline-actions/lib/action";
import {EcsDeployAction} from "@aws-cdk/aws-codepipeline-actions";

export class FargateServiceFactory extends ServiceFactory {
    fargateServiceLayer: FargateServiceLayer;
    service: IBaseService;
    containerName: string;
    ecrRepo: Repository;

    buildSpec(): BuildSpec {
        return BuildSpec.fromObject({
            version: '0.2',
            phases: {
                pre_build: {
                    commands: [
                        'echo Logging in to Amazon ECR...',
                        'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com',
                        'echo Logged in to ECR with $AWS_ACCOUNT_ID $AWS_REGION',
                        'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
                        'IMAGE_TAG=${COMMIT_HASH:=latest}',
                        'echo Ready to build on commit=$COMMIT_HASH with image=$IMAGE_TAG...'
                    ]
                },
                build: {
                    commands: [
                        'echo Build started on `date`',
                        'echo Building the Docker image with $REPOSITORY_URI...',
                        'docker build -t $REPOSITORY_URI:latest .',
                        'echo Tagging the built docker image with $IMAGE_TAG...',
                        'docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG',
                    ]
                },
                post_build: {
                    commands: [
                        'echo Build completed on `date`',
                        'echo Pushing the Docker image to ${REPOSITORY_URI}:latest...',
                        'docker push $REPOSITORY_URI:latest',
                        'echo Pushing the Docker image to ${REPOSITORY_URI}:$IMAGE_TAG...',
                        'docker push $REPOSITORY_URI:$IMAGE_TAG',
                        'printf "[{\\"name\\":\\"${CONTAINER_NAME}\\",\\"imageUri\\":\\"${REPOSITORY_URI}:latest\\"}]" > imagedefinitions.json'
                    ]
                }
            },
            artifacts: {
                files: [
                    'imagedefinitions.json'
                ]
            }
        });
    }

    // @ts-ignore
    deployAction(scope: Construct, buildOutput: Artifact): Action {
        return new EcsDeployAction({
            actionName: 'Deploy',
            input: buildOutput,
            service: this.service,
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
            },
            REPOSITORY_URI: {
                value: this.ecrRepo.repositoryUri
            },
            CONTAINER_NAME: {
                value: this.containerName
            }
        }
    }

    serviceLayer(scope: Construct, id: string, props: ServiceLayerProps): ServiceLayer {
        this.fargateServiceLayer = new FargateServiceLayer(scope, id, props);

        this.service = this.fargateServiceLayer.service;
        this.ecrRepo = this.fargateServiceLayer.ecrRepo;
        this.containerName = this.fargateServiceLayer.containerName;

        return this.fargateServiceLayer
    }

    addProjectPermissions(project: Project) {
        this.ecrRepo.grantPullPush(project.grantPrincipal);
    }
}
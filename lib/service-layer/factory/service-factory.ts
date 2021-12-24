import {ServiceLayer, ServiceLayerProps} from "../service-layer";
import {Construct} from "@aws-cdk/core";
import {BuildSpec, Project} from "@aws-cdk/aws-codebuild";
import {Service} from "../../configurations/service";
import {FargateServiceFactory} from "./fargate-service-factory"
import {Ec2ServiceFactory} from "./ec2-service-factory";
import {BuildEnvironmentVariable} from "@aws-cdk/aws-codebuild/lib/project";
import {Action} from "@aws-cdk/aws-codepipeline-actions/lib/action";
import {Artifact} from "@aws-cdk/aws-codepipeline";

export interface EnvironmentVariables {
    [name: string]: BuildEnvironmentVariable;
}

export abstract class ServiceFactory {
    abstract serviceLayer(scope: Construct, id: string, props: ServiceLayerProps): ServiceLayer;
    abstract buildSpec(): BuildSpec;
    abstract environmentVariables(scope: Construct): EnvironmentVariables
    abstract deployAction(scope: Construct, buildOutput: Artifact): Action
    abstract addProjectPermissions(project: Project): void

    public static instance(service: Service) : ServiceFactory {
        switch (service.server) {
            case 'Fargate': {
                return new FargateServiceFactory()
            }
            case 'Ec2' : {
                return new Ec2ServiceFactory()
            }
            default: {
                throw new TypeError(`Invalid type ${service.server}`)
            }
        }
    }
}
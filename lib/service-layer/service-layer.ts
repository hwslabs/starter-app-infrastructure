import {Construct} from "@aws-cdk/core";
import {HostedZone, IHostedZone} from "@aws-cdk/aws-route53";
import {DnsValidatedCertificate, ICertificate} from "@aws-cdk/aws-certificatemanager";
import {NetworkLayer} from "../network-layer";
import {DataLayer} from "../data-layer";
import {Service} from "../configurations/service";

export interface ServiceLayerProps {
    networkLayer: NetworkLayer,
    dataLayer: DataLayer,
    service: Service,
    cacheConf?: string,
    dbConf?: string,
}

export abstract class ServiceLayer extends Construct {
    protected readonly subDomain: string;
    protected readonly domainZone: IHostedZone;
    protected readonly endpoint: string;
    protected readonly certificate: ICertificate;

    protected constructor(scope: Construct, id: string, props: ServiceLayerProps) {
        super(scope, id);

        this.subDomain = props.service.name;
        this.domainZone = HostedZone.fromLookup(this, 'StagingZone', { domainName : props.service.zoneName });
        this.endpoint = props.service.endpoint
        this.certificate = new DnsValidatedCertificate(this, 'Certificate', {
            domainName: this.endpoint,
            hostedZone: this.domainZone
        });
    }

}
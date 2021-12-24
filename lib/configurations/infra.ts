import {Service} from "./service";
import {Database} from "./database";
import {Cache} from "./cache";
import {Deployment} from "./deployment";

export interface Infrastructure {
    nat?: string,
    deployment: Deployment,
    cache: Cache,
    database: Database,
    service: Service
}
import { ClientProxy } from '@nestjs/microservices';
export declare class GrantsLookupService {
    private readonly grantsClient;
    constructor(grantsClient: ClientProxy);
    getViewableFieldsForEntity(groupIds: string[], entityName: string): Promise<Set<string>>;
}

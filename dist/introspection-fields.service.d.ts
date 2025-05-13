import { ClientProxy } from '@nestjs/microservices';
export interface LocalIntrospectionConfig {
    maxDepth?: number;
    debug?: boolean;
    allowedTypes?: string[];
}
export declare class IntrospectionFieldsService {
    private readonly gatewayClient;
    private readonly logger;
    private schemaCache;
    private fieldsCache;
    private maxDepth;
    private debug;
    private allowedTypes;
    constructor(gatewayClient: ClientProxy);
    configure(cfg: LocalIntrospectionConfig): void;
    warmUpEntities(entityNames: string[]): Promise<void>;
    getAllFieldsForEntity(entityName: string): Promise<Set<string>>;
    private getOrLoadSchema;
    private collectAllFieldsOfEntity;
}

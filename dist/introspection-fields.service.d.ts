import { OnModuleInit } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
/**
 * Configurazione opzionale per il servizio di introspezione locale.
 */
export interface LocalIntrospectionConfig {
    /**
     * Profondità massima di ricorsione.
     * Se =2, scendiamo al secondo livello (es: `authData.email`),
     * ma non oltre (es: `nested.something.x`).
     * Default = 2.
     */
    maxDepth?: number;
    /**
     * Se true, logga dettagli di debug.
     * Default = false.
     */
    debug?: boolean;
    /**
     * Elenco di tipi (nome __typename) considerati “locali”.
     * Se durante la ricorsione trovi un objectType “non incluso” qui,
     * non scendi ricorsivamente nei suoi campi.
     *
     * Esempio: [ "User", "AuthDataSchema", "PersonalDataSchema", ... ].
     */
    allowedTypes?: string[];
}
/**
 * Esempio di servizio che si appoggia sullo *schema locale* (subgraph) di NestJS,
 * usando `GraphQLSchemaHost` per introspezionare i tipi e i campi *senza* contattare
 * il Gateway.
 */
export declare class LocalSchemaFieldsService implements OnModuleInit {
    private readonly schemaHost;
    private readonly logger;
    private localSchema;
    private fieldsCache;
    private maxDepth;
    private debug;
    private allowedTypes;
    /**
     * `GraphQLSchemaHost` è fornito da `@nestjs/graphql`.
     * Contiene la proprietà `schema`: GraphQLSchema del subgraph locale.
     */
    constructor(schemaHost: GraphQLSchemaHost);
    /**
     * Se vuoi cambiare i settaggi (maxDepth, debug, allowedTypes), invoca `configure()`
     * dal tuo modulo o altrove, prima di `warmUpEntities()`.
     */
    configure(cfg: LocalIntrospectionConfig): void;
    /**
     * Quando il modulo Nest si inizializza, recuperiamo lo schema locale
     * da `GraphQLSchemaHost`.
     */
    onModuleInit(): void;
    /**
     * Precarica (in cache) i fieldPaths per un elenco di entità (es: “User”, “AuthDataSchema”…).
     */
    warmUpEntities(entityNames: string[]): void;
    /**
     * Restituisce (o calcola) la lista di fieldPaths locali per una data entità.
     */
    getAllFieldsForEntity(entityName: string): Set<string>;
    /**
     * Esegue una ricorsione sullo schema “locale” (this.localSchema),
     * raccogliendo i fieldPaths dell’entità “entityName”, con profondità max = this.maxDepth
     * e scendendo solo nei tipi definiti in “allowedTypes”.
     */
    private collectAllFieldsOfEntity;
}

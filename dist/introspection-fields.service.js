"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LocalSchemaFieldsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalSchemaFieldsService = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const graphql_2 = require("graphql");
/**
 * Esempio di servizio che si appoggia sullo *schema locale* (subgraph) di NestJS,
 * usando `GraphQLSchemaHost` per introspezionare i tipi e i campi *senza* contattare
 * il Gateway.
 */
let LocalSchemaFieldsService = LocalSchemaFieldsService_1 = class LocalSchemaFieldsService {
    /**
     * `GraphQLSchemaHost` è fornito da `@nestjs/graphql`.
     * Contiene la proprietà `schema`: GraphQLSchema del subgraph locale.
     */
    constructor(schemaHost) {
        this.schemaHost = schemaHost;
        this.logger = new common_1.Logger(LocalSchemaFieldsService_1.name);
        // Lo schema GraphQL locale (subgraph), caricato in onModuleInit
        this.localSchema = null;
        // Cache di entityName => set di fieldPaths
        this.fieldsCache = new Map();
        // Config con valori di default
        this.maxDepth = 2;
        this.debug = false;
        this.allowedTypes = new Set();
        // Di default, lasciamo le config com’erano.
        // Le eventuali customizzazioni le facciamo con `configure()`.
    }
    /**
     * Se vuoi cambiare i settaggi (maxDepth, debug, allowedTypes), invoca `configure()`
     * dal tuo modulo o altrove, prima di `warmUpEntities()`.
     */
    configure(cfg) {
        if (cfg.maxDepth != null)
            this.maxDepth = cfg.maxDepth;
        if (cfg.debug != null)
            this.debug = cfg.debug;
        if (cfg.allowedTypes) {
            this.allowedTypes = new Set(cfg.allowedTypes);
        }
        if (this.debug) {
            this.logger.log(`LocalSchemaFieldsService -> configured: maxDepth=${this.maxDepth}, debug=${this.debug}`);
            this.logger.log(`allowedTypes = [${[...this.allowedTypes].join(', ')}]`);
        }
    }
    /**
     * Quando il modulo Nest si inizializza, recuperiamo lo schema locale
     * da `GraphQLSchemaHost`.
     */
    onModuleInit() {
        this.localSchema = this.schemaHost.schema;
        if (this.debug) {
            this.logger.log(`onModuleInit => schema locale caricato (Federation subgraph).`);
        }
    }
    /**
     * Precarica (in cache) i fieldPaths per un elenco di entità (es: “User”, “AuthDataSchema”…).
     */
    warmUpEntities(entityNames) {
        if (!this.localSchema) {
            throw new Error(`LocalSchemaFieldsService - schema non ancora disponibile (onModuleInit non chiamato?)`);
        }
        if (this.debug) {
            this.logger.log(`warmUpEntities => [${entityNames.join(', ')}], maxDepth=${this.maxDepth}`);
        }
        for (const eName of entityNames) {
            const setOfFields = this.collectAllFieldsOfEntity(eName);
            this.fieldsCache.set(eName, setOfFields);
            if (this.debug) {
                this.logger.debug(`Precaricato "${eName}" => tot campi: ${setOfFields.size}`);
            }
        }
    }
    /**
     * Restituisce (o calcola) la lista di fieldPaths locali per una data entità.
     */
    getAllFieldsForEntity(entityName) {
        // Se già in cache, ritorno
        if (this.fieldsCache.has(entityName)) {
            return this.fieldsCache.get(entityName);
        }
        // Altrimenti calcolo e salvo
        const setOfFields = this.collectAllFieldsOfEntity(entityName);
        this.fieldsCache.set(entityName, setOfFields);
        return setOfFields;
    }
    // -------------------------------------------------------------------------
    // Metodi interni
    // -------------------------------------------------------------------------
    /**
     * Esegue una ricorsione sullo schema “locale” (this.localSchema),
     * raccogliendo i fieldPaths dell’entità “entityName”, con profondità max = this.maxDepth
     * e scendendo solo nei tipi definiti in “allowedTypes”.
     */
    collectAllFieldsOfEntity(entityName) {
        if (!this.localSchema) {
            throw new Error(`LocalSchemaFieldsService => schema non disponibile`);
        }
        // Se l’entità non è tra i “allowedTypes”, ignoriamo
        if (!this.allowedTypes.has(entityName)) {
            if (this.debug) {
                this.logger.warn(`Entity "${entityName}" non è in allowedTypes => skip`);
            }
            return new Set();
        }
        // Troviamo il GraphQLObjectType
        const typeMap = this.localSchema.getTypeMap();
        const wantedType = typeMap[entityName];
        if (!wantedType || !(0, graphql_2.isObjectType)(wantedType)) {
            if (this.debug) {
                this.logger.warn(`Type "${entityName}" non trovato nel subgraph, oppure non è un objectType.`);
            }
            return new Set();
        }
        // Ricorsione
        const results = new Set();
        const visit = (objType, prefix, depth) => {
            if (depth > this.maxDepth) {
                return;
            }
            const fieldsMap = objType.getFields();
            if (this.debug) {
                this.logger.verbose(`(depth=${depth}) objectType="${objType.name}" => #fields=${Object.keys(fieldsMap).length}`);
            }
            for (const fieldName of Object.keys(fieldsMap)) {
                const fieldPath = prefix ? `${prefix}.${fieldName}` : fieldName;
                results.add(fieldPath);
                if (this.debug) {
                    this.logger.debug(`    + Aggiungo fieldPath="${fieldPath}" (depth=${depth})`);
                }
                // Se sotto-tipo è un objectType e rientra nei “allowedTypes”, scendo di livello
                const field = fieldsMap[fieldName];
                const namedType = (0, graphql_2.getNamedType)(field.type); // rimuove eventuali NonNull/List
                if ((0, graphql_2.isObjectType)(namedType) &&
                    this.allowedTypes.has(namedType.name) &&
                    depth < this.maxDepth) {
                    visit(namedType, fieldPath, depth + 1);
                }
            }
        };
        // Avvio
        visit(wantedType, '', 1);
        return results;
    }
};
exports.LocalSchemaFieldsService = LocalSchemaFieldsService;
exports.LocalSchemaFieldsService = LocalSchemaFieldsService = LocalSchemaFieldsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [graphql_1.GraphQLSchemaHost])
], LocalSchemaFieldsService);

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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntrospectionFieldsService = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const rxjs_1 = require("rxjs");
const graphql_1 = require("graphql");
let IntrospectionFieldsService = class IntrospectionFieldsService {
    constructor(gatewayClient) {
        this.gatewayClient = gatewayClient;
        this.logger = new common_1.Logger('IntrospectionFieldsService');
        this.schemaCache = null;
        this.fieldsCache = new Map();
        this.maxDepth = 2;
        this.debug = false;
        this.allowedTypes = new Set();
    }
    configure(cfg) {
        if (cfg.maxDepth != null)
            this.maxDepth = cfg.maxDepth;
        if (cfg.debug != null)
            this.debug = cfg.debug;
        if (cfg.allowedTypes) {
            this.allowedTypes = new Set(cfg.allowedTypes);
        }
        if (this.debug) {
            this.logger.log(`IntrospectionFieldsService -> configured: maxDepth=${this.maxDepth}, debug=${this.debug}`);
            this.logger.log(`allowedTypes=${[...this.allowedTypes].join(', ')}`);
        }
    }
    async warmUpEntities(entityNames) {
        if (this.debug) {
            this.logger.log(`warmUpEntities => [${entityNames.join(', ')}], maxDepth=${this.maxDepth}`);
        }
        const schema = await this.getOrLoadSchema();
        for (const eName of entityNames) {
            const setOfFields = this.collectAllFieldsOfEntity(schema, eName);
            this.fieldsCache.set(eName, setOfFields);
            if (this.debug) {
                this.logger.debug(`Precaricato "${eName}" => tot campi: ${setOfFields.size}`);
            }
        }
    }
    async getAllFieldsForEntity(entityName) {
        if (this.fieldsCache.has(entityName)) {
            return this.fieldsCache.get(entityName);
        }
        const schema = await this.getOrLoadSchema();
        const fields = this.collectAllFieldsOfEntity(schema, entityName);
        this.fieldsCache.set(entityName, fields);
        return fields;
    }
    async getOrLoadSchema() {
        if (this.schemaCache) {
            return this.schemaCache;
        }
        if (this.debug) {
            this.logger.log(`Carico schema via "INTROSPECT_GATEWAY"…`);
        }
        const resp$ = this.gatewayClient.send('INTROSPECT_GATEWAY', {});
        const { success, data } = await (0, rxjs_1.lastValueFrom)(resp$);
        if (!success || !data?.__schema) {
            throw new Error('Introspection data invalid or success=false');
        }
        this.schemaCache = (0, graphql_1.buildClientSchema)(data);
        return this.schemaCache;
    }
    collectAllFieldsOfEntity(schema, entityName) {
        if (!this.allowedTypes.has(entityName)) {
            if (this.debug) {
                this.logger.warn(`Entity "${entityName}" non è in allowedTypes => skip`);
            }
            return new Set();
        }
        const typeMap = schema.getTypeMap();
        const wanted = typeMap[entityName];
        if (!wanted || !(0, graphql_1.isObjectType)(wanted)) {
            if (this.debug) {
                this.logger.warn(`Type "${entityName}" non trovato o non è un ObjectType.`);
            }
            return new Set();
        }
        const results = new Set();
        const visit = (objType, prefix, depth) => {
            if (depth > this.maxDepth) {
                return;
            }
            const fieldsMap = objType.getFields();
            if (this.debug) {
                this.logger.verbose(`[Depth=${depth}] objectType="${objType.name}" => #fields=${Object.keys(fieldsMap).length}`);
            }
            for (const fieldName of Object.keys(fieldsMap)) {
                const path = prefix ? `${prefix}.${fieldName}` : fieldName;
                results.add(path);
                if (this.debug) {
                    this.logger.debug(`    + Aggiungo fieldPath="${path}" (depth=${depth})`);
                }
                const field = fieldsMap[fieldName];
                const namedType = (0, graphql_1.getNamedType)(field.type);
                if ((0, graphql_1.isObjectType)(namedType) && this.allowedTypes.has(namedType.name) && depth < this.maxDepth) {
                    visit(namedType, path, depth + 1);
                }
            }
        };
        visit(wanted, '', 1);
        return results;
    }
};
IntrospectionFieldsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('GATEWAY_SERVICE')),
    __metadata("design:paramtypes", [microservices_1.ClientProxy])
], IntrospectionFieldsService);
exports.IntrospectionFieldsService = IntrospectionFieldsService;

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import {
  buildClientSchema,
  getNamedType,
  isObjectType,
  GraphQLObjectType,
  IntrospectionQuery,
} from 'graphql';

export interface LocalIntrospectionConfig {
  maxDepth?: number;
  debug?: boolean;
  allowedTypes?: string[];
}

@Injectable()
export class IntrospectionFieldsService {
  private readonly logger = new Logger('IntrospectionFieldsService');

  private schemaCache: ReturnType<typeof buildClientSchema> | null = null;
  private fieldsCache = new Map<string, Set<string>>();

  private maxDepth = 2;
  private debug = false;
  private allowedTypes = new Set<string>();

  constructor(
    @Inject('GATEWAY_SERVICE')
    private readonly gatewayClient: ClientProxy,
  ) {}

  public configure(cfg: LocalIntrospectionConfig) {
    if (cfg.maxDepth != null) this.maxDepth = cfg.maxDepth;
    if (cfg.debug != null)    this.debug    = cfg.debug;
    if (cfg.allowedTypes) {
      this.allowedTypes = new Set(cfg.allowedTypes);
    }
    if (this.debug) {
      this.logger.log(`IntrospectionFieldsService -> configured: maxDepth=${this.maxDepth}, debug=${this.debug}`);
      this.logger.log(`allowedTypes=${[...this.allowedTypes].join(', ')}`);
    }
  }

  public async warmUpEntities(entityNames: string[]): Promise<void> {
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

  public async getAllFieldsForEntity(entityName: string): Promise<Set<string>> {
    if (this.fieldsCache.has(entityName)) {
      return this.fieldsCache.get(entityName)!;
    }
    const schema = await this.getOrLoadSchema();
    const fields = this.collectAllFieldsOfEntity(schema, entityName);
    this.fieldsCache.set(entityName, fields);
    return fields;
  }

  private async getOrLoadSchema() {
    if (this.schemaCache) {
      return this.schemaCache;
    }
    if (this.debug) {
      this.logger.log(`Carico schema via "INTROSPECT_GATEWAY"…`);
    }
    const resp$ = this.gatewayClient.send<{ success: boolean; data: IntrospectionQuery }>(
      'INTROSPECT_GATEWAY', {},
    );
    const { success, data } = await lastValueFrom(resp$);
    if (!success || !data?.__schema) {
      throw new Error('Introspection data invalid or success=false');
    }
    this.schemaCache = buildClientSchema(data);
    return this.schemaCache;
  }

  private collectAllFieldsOfEntity(schema: ReturnType<typeof buildClientSchema>, entityName: string): Set<string> {
    if (!this.allowedTypes.has(entityName)) {
      if (this.debug) {
        this.logger.warn(`Entity "${entityName}" non è in allowedTypes => skip`);
      }
      return new Set();
    }
    const typeMap = schema.getTypeMap();
    const wanted = typeMap[entityName];
    if (!wanted || !isObjectType(wanted)) {
      if (this.debug) {
        this.logger.warn(`Type "${entityName}" non trovato o non è un ObjectType.`);
      }
      return new Set();
    }

    const results = new Set<string>();
    const visit = (objType: GraphQLObjectType, prefix: string, depth: number) => {
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
        const namedType = getNamedType(field.type);
        if (isObjectType(namedType) && this.allowedTypes.has(namedType.name) && depth < this.maxDepth) {
          visit(namedType, path, depth + 1);
        }
      }
    };
    visit(wanted, '', 1);

    return results;
  }
}
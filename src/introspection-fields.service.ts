import { Injectable, Logger } from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import {
  GraphQLSchema,
  GraphQLObjectType,
  getNamedType,
  isObjectType,
} from 'graphql';

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
@Injectable()
export class LocalSchemaFieldsService implements OnModuleInit {
  private readonly logger = new Logger(LocalSchemaFieldsService.name);

  // Lo schema GraphQL locale (subgraph), caricato in onModuleInit
  private localSchema: GraphQLSchema | null = null;

  // Cache di entityName => set di fieldPaths
  private fieldsCache = new Map<string, Set<string>>();

  // Config con valori di default
  private maxDepth = 2;
  private debug = false;
  private allowedTypes = new Set<string>();

  /**
   * `GraphQLSchemaHost` è fornito da `@nestjs/graphql`.
   * Contiene la proprietà `schema`: GraphQLSchema del subgraph locale.
   */
  constructor(
    private readonly schemaHost: GraphQLSchemaHost,
  ) {
    // Di default, lasciamo le config com’erano.
    // Le eventuali customizzazioni le facciamo con `configure()`.
  }

  /**
   * Se vuoi cambiare i settaggi (maxDepth, debug, allowedTypes), invoca `configure()`
   * dal tuo modulo o altrove, prima di `warmUpEntities()`.
   */
  public configure(cfg: LocalIntrospectionConfig) {
    if (cfg.maxDepth != null) this.maxDepth = cfg.maxDepth;
    if (cfg.debug != null)    this.debug    = cfg.debug;
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
  onModuleInit(): void {
    this.localSchema = this.schemaHost.schema;
    if (this.debug) {
      this.logger.log(`onModuleInit => schema locale caricato (Federation subgraph).`);
    }
  }

  /**
   * Precarica (in cache) i fieldPaths per un elenco di entità (es: “User”, “AuthDataSchema”…).
   */
  public warmUpEntities(entityNames: string[]): void {
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
  public getAllFieldsForEntity(entityName: string): Set<string> {
    // Se già in cache, ritorno
    if (this.fieldsCache.has(entityName)) {
      return this.fieldsCache.get(entityName)!;
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
  private collectAllFieldsOfEntity(entityName: string): Set<string> {
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
    if (!wantedType || !isObjectType(wantedType)) {
      if (this.debug) {
        this.logger.warn(`Type "${entityName}" non trovato nel subgraph, oppure non è un objectType.`);
      }
      return new Set();
    }

    // Ricorsione
    const results = new Set<string>();

    const visit = (objType: GraphQLObjectType, prefix: string, depth: number) => {
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
        const namedType = getNamedType(field.type); // rimuove eventuali NonNull/List
        if (
          isObjectType(namedType) &&
          this.allowedTypes.has(namedType.name) &&
          depth < this.maxDepth
        ) {
          visit(namedType, fieldPath, depth + 1);
        }
      }
    };

    // Avvio
    visit(wantedType, '', 1);
    return results;
  }
}
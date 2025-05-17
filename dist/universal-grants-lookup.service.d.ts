/**
 * `_shared/field-level-grants/src/universal-grants-lookup.service.ts`
 *
 * Classe di lookup “universale” (remoto vs. locale) SENZA importare `GrantsService`.
 * - Se troviamo un `ClientProxy` per `GRANTS_SERVICE`, faremo le chiamate RPC
 *   per recuperare i permessi field-level (via `FIND_PERMISSIONS_BY_GROUP`).
 * - Se NON troviamo un `ClientProxy`, significa che siamo “dentro” Grants
 *   e la logica va fatta con un “adapter” che deve fornirci lo stesso servizio localmente
 *   (ad es. via callback, oppure un provider di tipo `IGrantsLocalAdapter`).
 */
import { ClientProxy } from '@nestjs/microservices';
export interface IGrantsLocalAdapter {
    /**
     * Ritorna le Permission (field-level) relative a `groupId`.
     * Ogni record con { fieldPath: string, canView: boolean, entityName: string }
     */
    findPermissionsByGroup(groupId: string): Promise<Array<{
        entityName: string;
        fieldPath: string;
        canView: boolean;
    }>>;
}
/**
 * Interfaccia astratta di questa classe:
 *  potresti esportarla se vuoi tipizzare le iniezioni altrove.
 */
export interface IUniversalGrantsLookupService {
    getViewableFieldsForEntity(groupIds: string[], entityName: string): Promise<Set<string>>;
}
/**
 * Service “universale” che decide al volo se usare RPC o adapter locale.
 */
export declare class UniversalGrantsLookupService implements IUniversalGrantsLookupService {
    /**
     * Se siamo in un microservizio DIVERSO da Grants,
     * allora avremo un `@Inject('GRANTS_SERVICE') ClientProxy`.
     * Se non esiste, il valore sarà `null`.
     */
    private readonly remoteClient;
    /**
     * Se siamo DENTRO al microservizio Grants, iniettiamo un adapter
     * (implementa `IGrantsLocalAdapter`) che fornisce `findPermissionsByGroup(...)`.
     * Se non esiste, il valore è `null`.
     */
    private readonly localAdapter;
    constructor(
    /**
     * Se siamo in un microservizio DIVERSO da Grants,
     * allora avremo un `@Inject('GRANTS_SERVICE') ClientProxy`.
     * Se non esiste, il valore sarà `null`.
     */
    remoteClient: ClientProxy | null, 
    /**
     * Se siamo DENTRO al microservizio Grants, iniettiamo un adapter
     * (implementa `IGrantsLocalAdapter`) che fornisce `findPermissionsByGroup(...)`.
     * Se non esiste, il valore è `null`.
     */
    localAdapter: IGrantsLocalAdapter | null);
    /**
     * Per ogni groupId, recupera tutte le permission con `entityName` e `canView=true`,
     * e unisce i `fieldPath` in un unico set.
     */
    getViewableFieldsForEntity(groupIds: string[], entityName: string): Promise<Set<string>>;
    private getViewableFieldsViaRPC;
    private getViewableFieldsViaLocalAdapter;
}

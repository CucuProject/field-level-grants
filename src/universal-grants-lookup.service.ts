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

import { Injectable, Inject, Optional } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

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
@Injectable()
export class UniversalGrantsLookupService implements IUniversalGrantsLookupService {
  constructor(
    /**
     * Se siamo in un microservizio DIVERSO da Grants,
     * allora avremo un `@Inject('GRANTS_SERVICE') ClientProxy`.
     * Se non esiste, il valore sarà `null`.
     */
    @Optional()
    @Inject('GRANTS_SERVICE')
    private readonly remoteClient: ClientProxy | null,

    /**
     * Se siamo DENTRO al microservizio Grants, iniettiamo un adapter
     * (implementa `IGrantsLocalAdapter`) che fornisce `findPermissionsByGroup(...)`.
     * Se non esiste, il valore è `null`.
     */
    @Optional()
    @Inject('GRANTS_LOCAL_ADAPTER')
    private readonly localAdapter: IGrantsLocalAdapter | null,
  ) {}

  /**
   * Per ogni groupId, recupera tutte le permission con `entityName` e `canView=true`,
   * e unisce i `fieldPath` in un unico set.
   */
  async getViewableFieldsForEntity(groupIds: string[], entityName: string): Promise<Set<string>> {
    if (this.remoteClient) {
      // CASO 1: siamo “esterni” => contattiamo Grants via RPC
      return this.getViewableFieldsViaRPC(groupIds, entityName);
    }
    if (this.localAdapter) {
      // CASO 2: siamo “interni” => usiamo l’adapter locale
      return this.getViewableFieldsViaLocalAdapter(groupIds, entityName);
    }

    throw new Error(
      `[UniversalGrantsLookupService] Impossibile recuperare i permessi: 
       né remoteClient né localAdapter disponibili.`
    );
  }

  // ---------------------------------------------------------------------
  // Metodi privati
  // ---------------------------------------------------------------------

  private async getViewableFieldsViaRPC(groupIds: string[], entityName: string): Promise<Set<string>> {
    const union = new Set<string>();
    for (const groupId of groupIds) {
      // Chiediamo a Grants (via pattern 'FIND_PERMISSIONS_BY_GROUP') le permission
      const perms = await lastValueFrom(
        this.remoteClient!.send<Array<{ fieldPath: string; canView: boolean; entityName: string }>>(
          'FIND_PERMISSIONS_BY_GROUP',
          { groupId, entityName },
        ),
      );
      for (const p of perms ?? []) {
        if (p.canView) {
          union.add(p.fieldPath);
        }
      }
    }
    return union;
  }

  private async getViewableFieldsViaLocalAdapter(groupIds: string[], entityName: string): Promise<Set<string>> {
    const union = new Set<string>();
    for (const groupId of groupIds) {
      const perms = await this.localAdapter!.findPermissionsByGroup(groupId);
      for (const p of perms) {
        if (p.entityName === entityName && p.canView) {
          union.add(p.fieldPath);
        }
      }
    }
    return union;
  }
}
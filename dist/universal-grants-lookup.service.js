"use strict";
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
exports.UniversalGrantsLookupService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
/**
 * Service “universale” che decide al volo se usare RPC o adapter locale.
 */
let UniversalGrantsLookupService = class UniversalGrantsLookupService {
    constructor(remoteClient, localAdapter) {
        this.remoteClient = remoteClient;
        this.localAdapter = localAdapter;
    }
    /**
     * Per ogni groupId, recupera tutte le permission con `entityName` e `canView=true`,
     * e unisce i `fieldPath` in un unico set.
     */
    async getViewableFieldsForEntity(groupIds, entityName) {
        if (this.remoteClient) {
            // CASO 1: siamo “esterni” => contattiamo Grants via RPC
            return this.getViewableFieldsViaRPC(groupIds, entityName);
        }
        if (this.localAdapter) {
            // CASO 2: siamo “interni” => usiamo l’adapter locale
            return this.getViewableFieldsViaLocalAdapter(groupIds, entityName);
        }
        throw new Error(`[UniversalGrantsLookupService] Impossibile recuperare i permessi: 
       né remoteClient né localAdapter disponibili.`);
    }
    // ---------------------------------------------------------------------
    // Metodi privati
    // ---------------------------------------------------------------------
    async getViewableFieldsViaRPC(groupIds, entityName) {
        const union = new Set();
        for (const groupId of groupIds) {
            // Chiediamo a Grants (via pattern 'FIND_PERMISSIONS_BY_GROUP') le permission
            const perms = await (0, rxjs_1.lastValueFrom)(this.remoteClient.send('FIND_PERMISSIONS_BY_GROUP', { groupId, entityName }));
            for (const p of perms ?? []) {
                if (p.canView) {
                    union.add(p.fieldPath);
                }
            }
        }
        return union;
    }
    async getViewableFieldsViaLocalAdapter(groupIds, entityName) {
        const union = new Set();
        for (const groupId of groupIds) {
            const perms = await this.localAdapter.findPermissionsByGroup(groupId);
            for (const p of perms) {
                if (p.entityName === entityName && p.canView) {
                    union.add(p.fieldPath);
                }
            }
        }
        return union;
    }
};
exports.UniversalGrantsLookupService = UniversalGrantsLookupService;
exports.UniversalGrantsLookupService = UniversalGrantsLookupService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)('GRANTS_SERVICE')),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)('GRANTS_LOCAL_ADAPTER')),
    __metadata("design:paramtypes", [Object, Object])
], UniversalGrantsLookupService);

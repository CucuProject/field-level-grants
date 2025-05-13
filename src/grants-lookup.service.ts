import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

interface FieldPermission {
  fieldPath: string;
  canView: boolean;
}

@Injectable()
export class GrantsLookupService {
  constructor(
    @Inject('GRANTS_SERVICE')
    private readonly grantsClient: ClientProxy,
  ) {}

  async getViewableFieldsForEntity(
    groupIds: string[],
    entityName: string,
  ): Promise<Set<string>> {
    const union = new Set<string>();
    for (const groupId of groupIds) {
      const resp = await lastValueFrom(
        this.grantsClient.send<FieldPermission[]>(
          'FIND_PERMISSIONS_BY_GROUP',
          { groupId, entityName },
        ),
      );
      for (const p of resp || []) {
        if (p.canView) {
          union.add(p.fieldPath);
        }
      }
    }
    return union;
  }
}
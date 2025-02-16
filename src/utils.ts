import { Kit } from './kit';
import { KitArrayToRecord } from './types';

export function buildKitRecordFromArray<Kits extends Kit[]>(
    kits: Kit[]
) {
    return kits.reduce((result, kit) => {
        result[kit.name] = kit;

        return result;
    }, {} as KitArrayToRecord<Kits>);
}

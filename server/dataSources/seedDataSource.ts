// DataSource: 시드 JSON 파일과 직접 통신. DTO 를 그대로 돌려준다 (개념편 5.2(1))
import housesJson from '../../data/houses.json';
import placesJson from '../../data/places.json';
import type { HouseDto, PlaceDto } from '../dtos/seedDto';

export interface ISeedDataSource
{
    loadHousesAsync(): Promise<HouseDto[]>;
    loadPlacesAsync(): Promise<PlaceDto[]>;
}

export class JsonSeedDataSource implements ISeedDataSource
{
    public async loadHousesAsync(): Promise<HouseDto[]>
    {
        return structuredClone((housesJson as { houses?: HouseDto[] }).houses ?? []);
    }

    public async loadPlacesAsync(): Promise<PlaceDto[]>
    {
        return structuredClone((placesJson as { places?: PlaceDto[] }).places ?? []);
    }
}

// Repository: 하우스 · 방 · 장소. 시드를 한 번 읽어 Model 로 바꿔 두고, 방 상태 변경을 보관한다
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { ISeedDataSource } from '../dataSources/seedDataSource';
import { toHouseModel, toPlaceModel, toRoomModel } from '../mappers/seedMapper';
import type { House, Place, Room, RoomStatus } from '../models/housing';

export interface IHousingRepository
{
    getHousesAsync(): Promise<Result<House[]>>;
    getHouseAsync(id: string): Promise<Result<House>>;
    getRoomsAsync(): Promise<Result<Room[]>>;
    getRoomAsync(id: string): Promise<Result<Room>>;
    setRoomStatusAsync(id: string, status: RoomStatus): Promise<Result<Room>>;
    getPlacesAsync(): Promise<Result<Place[]>>;
}

interface ICache
{
    houses: Map<string, House>;
    rooms: Map<string, Room>;
    places: Place[];
}

export class HousingRepository implements IHousingRepository
{
    private readonly _source: ISeedDataSource;
    private _cache: ICache | undefined;

    public constructor(source: ISeedDataSource)
    {
        this._source = source;
    }

    private async loadAsync(): Promise<Result<ICache>>
    {
        if (this._cache)
        {
            return success(this._cache);
        }
        try
        {
            // 서로 기다릴 필요 없는 두 파일은 동시에 읽는다
            const [houseDtos, placeDtos] = await Promise.all([this._source.loadHousesAsync(), this._source.loadPlacesAsync()]);
            const houses = new Map<string, House>();
            const rooms = new Map<string, Room>();
            for (const dto of houseDtos)
            {
                const house = toHouseModel(dto);
                houses.set(house.id, house);
                for (const roomDto of dto.rooms ?? [])
                {
                    const room = toRoomModel(roomDto, house.id);
                    rooms.set(room.id, room);
                }
            }
            this._cache = { houses, rooms, places: placeDtos.map(toPlaceModel) };
            return success(this._cache);
        }
        catch (error)
        {
            console.error('시드 데이터 읽기 실패', error);
            return failure(AppError.Storage);
        }
    }

    public async getHousesAsync(): Promise<Result<House[]>>
    {
        const cache = await this.loadAsync();
        return cache.ok ? success([...cache.data.houses.values()]) : cache;
    }

    public async getHouseAsync(id: string): Promise<Result<House>>
    {
        const cache = await this.loadAsync();
        if (!cache.ok)
        {
            return cache;
        }
        const house = cache.data.houses.get(id);
        return house ? success(house) : failure(AppError.NotFound);
    }

    public async getRoomsAsync(): Promise<Result<Room[]>>
    {
        const cache = await this.loadAsync();
        return cache.ok ? success([...cache.data.rooms.values()]) : cache;
    }

    public async getRoomAsync(id: string): Promise<Result<Room>>
    {
        const cache = await this.loadAsync();
        if (!cache.ok)
        {
            return cache;
        }
        const room = cache.data.rooms.get(id);
        return room ? success(room) : failure(AppError.NotFound);
    }

    public async setRoomStatusAsync(id: string, status: RoomStatus): Promise<Result<Room>>
    {
        const current = await this.getRoomAsync(id);
        if (!current.ok || !this._cache)
        {
            return current;
        }
        const updated: Room = { ...current.data, status };
        this._cache.rooms.set(id, updated);
        return success(updated);
    }

    public async getPlacesAsync(): Promise<Result<Place[]>>
    {
        const cache = await this.loadAsync();
        return cache.ok ? success(cache.data.places) : cache;
    }
}

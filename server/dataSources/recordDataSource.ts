// DataSource: 레코드 저장소 (CRUD). Mock 모드는 메모리, Real 모드는 D1 구현으로 바꿔 끼운다 (DIP)
export interface IRecord
{
    readonly id: string;
}

export interface IRecordDataSource<T extends IRecord>
{
    findAllAsync(): Promise<T[]>;
    findByIdAsync(id: string): Promise<T | undefined>;
    saveAsync(record: T): Promise<void>;
    deleteAsync(id: string): Promise<void>;
}

export class MemoryRecordDataSource<T extends IRecord> implements IRecordDataSource<T>
{
    private readonly _records = new Map<string, T>();

    public async findAllAsync(): Promise<T[]>
    {
        return [...this._records.values()];
    }

    public async findByIdAsync(id: string): Promise<T | undefined>
    {
        return this._records.get(id);
    }

    public async saveAsync(record: T): Promise<void>
    {
        this._records.set(record.id, record);
    }

    public async deleteAsync(id: string): Promise<void>
    {
        this._records.delete(id);
    }
}

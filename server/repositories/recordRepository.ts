// Repository: DataSource 를 숨기고 데이터 실패를 Result 로 바꾼다 (개념편 5.2(5))
import { AppError } from '../core/appError';
import { failure, success, type Result } from '../core/result';
import type { IRecord, IRecordDataSource } from '../dataSources/recordDataSource';

export interface IRecordRepository<T extends IRecord>
{
    getAllAsync(): Promise<Result<T[]>>;
    getAsync(id: string): Promise<Result<T>>;
    findWhereAsync(predicate: (record: T) => boolean): Promise<Result<T[]>>;
    saveAsync(record: T): Promise<Result<T>>;
    deleteAsync(id: string): Promise<Result<void>>;
}

export class RecordRepository<T extends IRecord> implements IRecordRepository<T>
{
    private readonly _source: IRecordDataSource<T>;

    public constructor(source: IRecordDataSource<T>)
    {
        this._source = source;
    }

    public async getAllAsync(): Promise<Result<T[]>>
    {
        try
        {
            return success(await this._source.findAllAsync());
        }
        catch (error)
        {
            console.error('저장소 읽기 실패', error);
            return failure(AppError.Storage);
        }
    }

    public async getAsync(id: string): Promise<Result<T>>
    {
        try
        {
            const record = await this._source.findByIdAsync(id);
            return record ? success(record) : failure(AppError.NotFound);
        }
        catch (error)
        {
            console.error('저장소 읽기 실패', error);
            return failure(AppError.Storage);
        }
    }

    public async findWhereAsync(predicate: (record: T) => boolean): Promise<Result<T[]>>
    {
        const all = await this.getAllAsync();
        return all.ok ? success(all.data.filter(predicate)) : all;
    }

    public async saveAsync(record: T): Promise<Result<T>>
    {
        try
        {
            await this._source.saveAsync(record);
            return success(record);
        }
        catch (error)
        {
            console.error('저장소 쓰기 실패', error);
            return failure(AppError.Storage);
        }
    }

    public async deleteAsync(id: string): Promise<Result<void>>
    {
        try
        {
            await this._source.deleteAsync(id);
            return success(undefined);
        }
        catch (error)
        {
            console.error('저장소 삭제 실패', error);
            return failure(AppError.Storage);
        }
    }
}

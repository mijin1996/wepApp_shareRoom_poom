// 실패 종류 (개념편 6.3 · 7.4)
// - 데이터 실패: Repository 가 만든다 (NotFound, Storage)
// - 규칙 실패: Service 가 만든다 (그 밖의 것)
export enum AppError
{
    // 데이터 실패
    NotFound = 'NotFound',
    Storage = 'Storage',

    // 입력 · 권한
    InvalidInput = 'InvalidInput',
    Unauthorized = 'Unauthorized',
    Forbidden = 'Forbidden',
    TooYoung = 'TooYoung',

    // 방 · 신청 규칙
    RoomNotVacant = 'RoomNotVacant',
    RoomTooSmall = 'RoomTooSmall',
    HouseholdTooLarge = 'HouseholdTooLarge',
    HouseTypeMismatch = 'HouseTypeMismatch',
    ApplicationInProgress = 'ApplicationInProgress',

    // 계약 · 결제 규칙
    NotApproved = 'NotApproved',
    DocumentRequired = 'DocumentRequired',
    NotPaid = 'NotPaid',
    PaymentFailed = 'PaymentFailed',
    AlreadyDone = 'AlreadyDone',

    // 신고 규칙
    TooManyReports = 'TooManyReports',
    ShotTooLarge = 'ShotTooLarge',
    ResolutionRequired = 'ResolutionRequired',
}

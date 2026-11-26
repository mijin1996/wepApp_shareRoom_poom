// 운영판 배포는 main 브랜치에서만 (QA 관리툴 원칙: 운영 출시는 사람이 결정)
import { execSync } from 'node:child_process';

const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
if (branch !== 'main')
{
    console.error(`운영판은 main 브랜치에서만 올릴 수 있어요. 지금 브랜치: ${branch}`);
    process.exit(1);
}
console.log('main 브랜치 확인 — 대표 승인을 받았는지 다시 확인하세요.');

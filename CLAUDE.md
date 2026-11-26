# Poom (품) Guidelines

## Project Overview
한부모 + 자녀 전용 쉐어룸 웹 (PWA, 한국어 · 영어). 방 찾기 → 본인인증 → 3단계 신청 + 서류 1장 → 2시간 안 상담 · 서류 확인 → 전자계약 · 결제 → 당일 입주.
처음에는 외부 서비스 가입 없이 **Mock 데이터(`data/*.json` + 인메모리 저장소)**로 전체 흐름을 완성하고, 필요한 시점에 Cloudflare D1 · R2 · 본인인증 · PG · 문자를 연결한다.

기획 원본은 `docs/Proposal/` — 목차 `docs/Proposal/common_Index.md`.

## Tech Stack & Architecture
- **화면**: React + Vite + TypeScript, PWA, 문구는 `i18n/ko.json` · `i18n/en.json`
- **서버**: Cloudflare Workers (`functions/api/...`), DB: D1, 파일: R2
- **배포**: Cloudflare Pages, 빌드 결과 `dist/`만 배포
- **모드 분기 (`USE_MOCK`)**:
  - Mock (`USE_MOCK !== 'false'`): `data/houses.json` 등 JSON + 인메모리 저장, 본인인증 · 전자계약 · PG · 문자는 가짜 어댑터
  - Real (`USE_MOCK === 'false'`): D1 · R2 · 실제 업체 어댑터
- **SDD**: OpenSpec (`openspec/`) — `/opsx:propose` → `/opsx:apply` → `/opsx:archive`

## 🚫 절대 금지 사항
1. `docs/`, `openspec/`, `tests/`, `CLAUDE.md`, `README.md`를 배포 결과(`dist/`)에 넣지 않는다.
2. 하우스 정확한 주소 · 출입 정보를 결제 완료 전 API 응답에 넣지 않는다 (`POL_PRIVACY_03`).
3. 자녀 이름 · 생년월일 입력칸이나 필드를 만들지 않는다 (`POL_PRIVACY_01`).
4. 신청자에게 범죄 경력 · 소득 · 재산 서류를 요구하는 기능을 만들지 않는다 (`POL_SAFETY_06` · `POL_HOUSE_03`).
5. 서류 확인 전에는 계약 서명 · 결제 · 입주 안내를 열지 않는다 (`POL_HOUSE_02`, 에러 `DOC_428`).
6. 문구를 코드에 직접 쓰지 않는다 — 항상 i18n 키. 한국어 · 영어 키가 다르면 빌드 실패.
7. API 키 · 비밀값은 하드코딩하지 않고 환경변수로.

## Development Workflow & Rules
1. **Spec 먼저**: 기능 추가 · 변경 전 `/opsx:propose <변경명>` → `tasks.md` 확인 → `/opsx:apply` → 확인 후 `/opsx:archive`.
2. **Mock-First & Clean Boundary**: 화면은 Mock인지 Real인지 몰라야 한다. 외부 서비스는 어댑터 인터페이스 뒤에.
3. **API 응답 형식**: `{ success: boolean, data?: unknown, error?: string }`, 에러 코드는 `docs/Proposal/developer_Data_API.md` §4.
4. **한글 입력**: `onKeyDown`에서 `e.nativeEvent.isComposing` 확인 (IME 중복 입력 방지).
5. **데이터 원본**: JSON + JSON Schema (`schema/`). CSV 쓰지 않음.
6. **테스트 · 커밋**: Given-When-Then 테스트가 하나 통과할 때마다 Conventional Commits(`feat:` · `fix:` · `refactor:`) 한국어 메시지로 커밋.
7. **기획 문서 동기화**: 동작이 바뀌면 같은 작업 안에서 `docs/Proposal/` 해당 문서도 고친다.
8. **배포**: 배포는 **테스트판(`dev` 브랜치)에만**. 운영판(`main`)은 대표가 "운영에 올려"라고 할 때만. 로그인 · 비밀번호는 사람이 직접.
9. **3분 기록**: 새 화면 · 주요 버튼 · 화면 이동을 만들면 3분 기록(`note()`)에 남긴다. 입력값 · 이름 · 전화번호는 기록하지 않는다 (`POL_REPORT_04`).
10. **신고 처리**: 신고 한 건은 ① 3분 기록 · 화면 위치대로 재현 → ② 가장 작게 수정 + 자동 테스트 → ③ 테스트판에서 확인 → ④ "원인 / 고친 것 / 확인 방법" 세 줄 정리. 재현이 안 되면 고치지 말고 더 필요한 정보를 적는다.

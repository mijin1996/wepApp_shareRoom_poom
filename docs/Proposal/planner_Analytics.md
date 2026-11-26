# 로그 · 지표 — Poom (품)

> 문서 세트: [목차](common_Index.md) · 기획: [브리프](owner_Brief.md) · [요구사항](planner_Requirements.md) · [정책](planner_Policy.md) · [IA·플로우](planner_IA_Flow.md) · [화면 설계](designer_Storyboard.md) · [데이터·API](developer_Data_API.md) · [기술·비기능](developer_Tech_NFR.md) · 사업·운영: [Business Model](planner_Monetization.md) · [운영 콘솔](planner_Admin.md) · **로그·지표** · [QA·출시](tester_Release.md) · [운영](operator_Operations.md) · [사업화·법무](owner_Legal.md) · [needFix](common_needFix.md)

> **문서 정보**

| 문서 번호 | 버전 | 상태 | 책임자 | 협업 | 최종 수정 | 관련 문서 |
|---|---|---|---|---|---|---|
| `D10-LOG` | v0.3 | `Draft` | PM | 프론트엔드 개발자 · 백엔드 개발자 | 2026-11-26 | [브리프](owner_Brief.md) §6 |

**변경 이력**

| 버전 | 날짜 | 변경 내용 | 사유 | 결정자 | 영향 범위 |
|---|---|---|---|---|---|
| v0.3 | 2026-11-27 | 검색 · 필터 · 관심 · 빈방 알림 · 0건 이벤트 | 원하는 지역 · 학교 · 직장 근처로 방을 찾게 함 | PM | 로그 |
| v0.2 | 2026-11-26 | 신고 이벤트 4개 | 민원 · 오류를 끝까지 처리하고 개선 방향을 정하기 위함 | PM | 로그 |
| v0.1 | 2026-11-26 | 첫 초안 | 서비스 기획 시작 | PM | 전체 |

---

## 1. 목적
출시 후 측정할 것. [브리프](owner_Brief.md) §6의 모든 지표를 아래 이벤트로 계산.

## 2. 이벤트
| 이벤트 | 발생 시점 | 파라미터 | 확인할 지표 |
|---|---|---|---|
| `evt_room_list_view` | 방 목록 진입 | filter_now(bool), type, view(list / map) | 유입 · 지도 사용률 |
| `evt_search` | 검색 항목 고름 | kind(area / station / school / daycare / house / chip) | 무엇으로 찾나 |
| `evt_search_empty` | 결과 0건 | gu, household_size, price_band | **지역 수요** (다음 하우스 위치) |
| `evt_filter_apply` | 필터 적용 | keys[] (값 없이 이름만) | 많이 쓰는 필터 |
| `evt_favorite` | 관심 방 ♡ | on(bool) | 관심 → 신청 전환 |
| `evt_saved_search` | 빈방 알림 켬 | — | 알림 → 재방문 · 신청 |
| `evt_room_view` | 방 상세 진입 | room_id, entry(list / home / share) | 상세 → 신청 전환 |
| `evt_auth_complete` | 본인인증 완료 | — | 인증 이탈률 |
| `evt_apply_step` | 신청 단계 이동 | step(1~3) | 단계별 이탈 |
| `evt_apply_submit` | 신청 제출 | room_id, months | 신청 수 |
| `evt_apply_decision` | 승인 · 보류 · 거절 | result, hours_to_call | 24시간 연락률 |
| `evt_contract_sign` | 서명 | months | 승인 → 계약 |
| `evt_pay_complete` | 첫 결제 완료 | method | 결제 실패율 |
| `evt_movein_complete` | 입주 처리 (콘솔) | days_from_apply | **North Star**, 입주 소요일 |
| `evt_contract_renew` | 연장 | months | 유지율 |
| `evt_help_open` | 긴급 도움 열기 | screen | 위기 상황 빈도 (운영 참고) |
| `evt_report_open` | 의견 · 신고 열기 | screen | 어느 화면에서 막히나 |
| `evt_report_submit` | 신고 보냄 | kind, with_shot(bool), channel | 종류별 신고 수 |
| `evt_report_status` | 상태 바뀜 (콘솔) | from, to, hours_since_created | **평균 처리 일수**, 기한 준수율 |
| `evt_report_confirm` | 신고자 확인 | resolved(bool) | 재신고 비율 |

- 모든 이벤트에 공통 파라미터 `lang`(`ko` / `en`) — 언어별 퍼널 · 이탈 비교
- `evt_lang_change` (언어 전환, from · to · screen)
- 이름 · 전화번호 · 주소 · 자녀 정보 · 국적은 파라미터에 넣지 않음
- 분석 도구로 개인정보가 넘어가지 않게 user_id는 해시

## 3. 퍼널
방 상세 → 본인인증 → 신청 제출 → 승인 → 서명 → 결제 → 입주

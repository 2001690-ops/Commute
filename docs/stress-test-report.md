# 연덕갈비 V4.2 — 15개월 모의 운영 테스트

검증일: 2026-10-25 (한국시간). 기간은 가상 시간으로 재현했으며 실제 15개월이 경과한 시험이 아닙니다.

## 결과

- 모의 운영 기간: 2025-08 ~ 2026-10, 15개월
- 모의 직원: 12명
- 근무기록: 4,704건, 기본 근무 17:00~22:30 / 휴게 30분
- 기능 시나리오: 23개 통과 / 0개 실패
- API 핸들러 요청: 124회. 실제 HTTP 네트워크 요청 수는 아닙니다.
- 15개월 급여 마감·재개·재마감 후 15개 마감 스냅샷과 기록 유지 확인
- 저장·재조회: 실제 인메모리 SQLite에서 확인. 최종 직렬화 데이터 1,784,689바이트
- 실제 직원 정보와 운영 데이터베이스를 조회하거나 변경하지 않았습니다.

## 기능별 범위

| 기능 | 확인한 동작 | 결과 |
|---|---|---|
| 관리자·직원 접속 | 관리자 로그인, 접근 차단, 로그인 제한, 초대 재발급·해제, 로그아웃, 개인정보 분리 | 통과 |
| 직원·시급 | 직원 생성, 계약 기준, 적용일별 시급, 재직 전환, 테스트용 비밀번호 초기화 | 통과 |
| 출퇴근 | 출근·휴게·복귀·퇴근, 중복 출근·퇴근 방지, 수기 입력·수정, 시간 중복 거부 | 통과 |
| 스케줄 | 반복 일정, 날짜별 변경, 여러 날짜 복사, 실패 시 전체 취소, 야간근무 | 통과 |
| 자동 예정기록 | 자동 방식 및 출근 확인 방식의 실제 근무 확정, 중복 확정·겹침 거부 | 통과 |
| 급여·가불 | 15개월 기본급 독립 계산 대조, 주휴 산식, 시급 변경, 세금 참고값, 공제·가불 지급·취소 | 통과 |
| 월 마감 | 15개월 마감·해제·재마감, 마감월 변경 차단 | 통과 |
| 근로계약 | 본문 저장, 테스트 직원 동의, 다운로드 응답, 사본 교부 기록 | 통과 |
| 신고·퇴직금 | 실제 시간과 참고 기준시간 분리, 월별 신고자료 대조, 퇴직금 참고 산식·윤년·연도 경계 | 통과 |
| 연결 오류·동시 변경 | 끊김·잘못된 응답, 저장 후 갱신 실패 안내, 같은 버전 동시 쓰기 중 한 건만 성공 | 통과 |
| 화면·CSV | 주요 6개 화면 렌더링, 직원 12행 급여표, 실제 CSV 다운로드 이벤트 | 통과 |

## 수정한 문제

1. 데이터가 쌓이면 동일한 월의 출퇴근 집계와 주휴 계산을 직원마다 반복했습니다. 한국 날짜 계산을 단순화하고 월별 기록에 인덱스를 사용하며, 한 번의 급여 계산 안에서만 결과를 공유하도록 개선했습니다. 다음 계산에서는 다시 생성하므로 수정 후 오래된 결과를 재사용하지 않습니다.
2. 예정근무를 실제 근무로 확정할 때 이전 날짜의 야간근무 등과 겹치는 실제 기록을 만들 수 있었습니다. 기존 실제 근무와 시간 범위가 겹치면 확정을 거부합니다.
3. 출퇴근 버튼으로 기록할 때 이미 입력된 수기 기록과의 시간 중복도 차단했습니다.

## 속도 측정

동일 테스트 서버, 직원 12명, 전체 근무기록 4,704건, 한 달 급여 계산 기준입니다.

- 수정 전: 별도 벤치마크가 45초 제한 안에 완료되지 않아 종료되었습니다.
- 수정 후: 최종 15개월 검증에서 월별 계산 16~53ms. 별도 2026-10 벤치마크 39ms.
- 브라우저 표시 시간, 통신 지연, 운영 Cloudflare의 CPU 제한과 D1 처리량을 측정한 수치는 아닙니다.

## 재실행

Node 24와 프로젝트 의존성을 사용합니다. SQLite는 프로세스 메모리에만 존재합니다.

```sh
node tests/stress-15-months.mjs
node tests/benchmark-payroll.mjs
node node_modules/typescript/bin/tsc --noEmit
```

자동 결과 파일: `docs/stress-test-results.json`. 테스트 실행은 이 결과를 다시 생성합니다.

## 검증 한계

- 생성한 15개월 기록은 모의 데이터이며, 모든 날짜의 기록을 실제 휴대폰 클릭으로 생성한 시험은 아닙니다.
- 기능 API는 실제 코드와 SQLite로 실행했지만 운영 Cloudflare/D1 네트워크·부하·용량 제한을 검증하지 않았습니다. 현재 자료는 한 JSON 행에 저장되므로 인원·보관기간 확장 시 저장 구조와 용량 점검이 필요합니다.
- 여러 실제 휴대폰의 동시 접속과 카카오톡 외부 공유·발송은 실측하지 않았습니다. 카카오 설정 형식과 초대 링크 관련 내부 동작만 검증했습니다.
- 급여 CSV 다운로드는 확인했지만 실물 인쇄와 PDF 레이아웃, 외부 기관의 신고서 접수는 검증하지 않았습니다. CSV는 기관 제출 원본 서식이 아닌 검토자료입니다.
- 계산 대조는 프로그램 산식 검증입니다. 세법·노동법상 모든 근무 형태와 예외에 대한 적법성을 인증하는 시험은 아닙니다.

## 통과한 시나리오

1. Owner auth, CSRF, admin setup/login and masked employee data — 통과
2. Profile, business settings, rates, repeated patterns and schedule copy — 통과
3. Advances, cancellation, payroll review, settings and Kakao key validation — 통과
4. Invite login, staff isolation, contract acceptance/download/delivery — 통과
5. Staff clock-in/break/resume/out, duplicate prevention and current status — 통과
6. Invitation reissue, revocation, retirement/reactivation and logout — 통과
7. Atomic copy rollback, zero break and overnight calculations — 통과
8. Clock rejects overlapping manual record and re-confirmation overlap — 통과
9. Attendance and confirmation include a previous-month open shift — 통과
10. Unpaid leave is resolved and does not permanently block month closing — 통과
11. Leap day, year boundary, retirement and reporting reference separation — 통과
12. Network errors, malformed responses, saved-but-refresh-failed and copy fallback — 통과
13. Optimistic concurrency prevents lost updates — 통과
14. Manual shift creation/edit, overlap rejection and unknown employee — 통과
15. Automatic and check-in schedule confirmation, attendance flags and leave — 통과
16. Weekly benefit arithmetic, absences, tax estimates and pay deductions — 통과
17. Admin login lockout and expired staff sessions — 통과
18. Parallel writes reject a stale revision and keep exactly one result — 통과
19. Confirmation via authenticated API and overlap protection at clock-in — 통과
20. Date boundaries use Korea time and do not reuse stale payroll caches — 통과
21. 15-month simulation: 12 employees, monthly payroll and independent money checks — 통과
22. 15 monthly close snapshots, closed protection and reopening — 통과
23. 15-month daily payroll report totals and no cross-employee leakage — 통과

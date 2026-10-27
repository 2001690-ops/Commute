# Commute V5.1 — 연덕갈비 출퇴근·급여 원본

2026-10-27 배포 소스입니다.
실제 서비스: https://yeondeok-attendance.honestflea17.chatgpt.site
원본 커밋: ee15c07f7c90614b580943e2f78ad1b2df4869de
제품 버전: 5.1 / Sites 저장 버전: 12

## 포함 기능
- 직원 첫 화면, 출근 버튼, 홈·내 일정·내 급여·더보기 하단 메뉴
- 관리자 오늘 근무·근무 일정·출퇴근 기록·급여 정산·직원 관리·자료 출력
- 개인 초대 링크, 위임 관리자 8자리 비밀번호, 권한·세션 검증
- 일정 복사·반복, 근무완료 확인 목록 및 일괄 확인
- 근로계약서, 급여명세서, 사업장 설정
- 단톡방 연결 메뉴 제거

## 파일과 데이터
전체 추적 소스와 의존성 잠금 파일을 포함합니다. node_modules, 빌드 산출물, 실제 직원/급여 DB, 개인 초대 링크, 운영 비밀번호는 포함하지 않습니다. 운영 데이터는 기존 서비스 DB에 유지됩니다. 기존 README의 V4.x 항목은 과거 변경 기록입니다.

## 실행 환경
이 소스는 Python 서버형 V5와 다른 React/TypeScript + Vinext + Cloudflare Workers/D1 앱입니다. HTML 파일을 두 번 클릭해서 실행하는 형태가 아닙니다. GitHub 업로드만으로 운영 사이트가 자동 갱신되지 않습니다.

Node.js 24 권장, pnpm 버전은 package.json의 packageManager를 따릅니다.
1. pnpm install --frozen-lockfile
2. pnpm run build
3. 로컬 D1 초기화: node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_neat_nekra.sql
4. pnpm run start

운영 배포는 Sites 작업 절차를 따릅니다. 별도 호스팅 이전 시 D1 바인딩과 ChatGPT 인증 연동을 구성해야 합니다. 로컬에는 호스팅의 인증 헤더가 자동 제공되지 않으므로 관리자 인증 전체 재현은 테스트 하네스를 사용하세요.

## 운영 환경 변수 (값은 별도 비밀 설정)
- OWNER_EMAIL: 사장님 인증 계정 이메일
- ADMIN_EMPLOYEE_IDS: 관리자 권한 직원 ID 목록
- DELEGATED_ADMIN_CREDENTIAL: employeeId, pin(숫자 8자리), version을 가진 JSON 비밀 값. 직원 ID는 DB의 해당 직원 ID와 일치해야 합니다. version 변경 시 기존 위임 관리자 세션이 만료됩니다.
운영 비밀번호를 소스나 공개 GitHub에 넣지 마세요.

## 확인한 시험
node tests/delegated-admin.mjs
node tests/staff.mjs
node tests/schedule-review.mjs
node tests/schedule-ui.mjs
node tests/workforce-api.mjs
node tests/menu-panels.mjs
빌드와 위 시험은 통과했습니다. 실제 휴대폰에서의 최종 클릭 검증은 미완료입니다.

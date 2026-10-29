# 연덕갈비 Commute V5.3.3

첨부 V5.3.3 전체 소스와 근태·급여 검토 수정본입니다. 실행·배포 전 [수정 내용과 DB 마이그레이션 안내](docs/V5.3.3-review-fixes.md)를 확인하세요.

# vinext-starter

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git and `tar` (including Windows `tar.exe`) are required for publishing; portable publication does not require Bash

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

Publish archives outside the source checkout or under its ignored `outputs/` directory. Local `.env*`, `.dev.vars*`, TypeScript build state, and tool runtime directories are ignored; keep the hosting manifest, migrations, and authored scripts in source control.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For managed Linux browser QA, follow the Sites skill's managed preview reference. The daemon runs the project's Vite dev script with `--host 0.0.0.0 --port 4173 --strictPort`; use the CLI's returned URL. The ignored local profile survives the daemon's cleared environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `worker/index.ts` is the production Worker entrypoint and preserves request-scoped connector bindings
- `scripts/vite/` contains the maintained Vite integrations and the vendored Sites plugin license
- `scripts/connector-preview/` contains the local connector preview Worker and session helpers
- the remaining `scripts/` files select execution profiles and run installation, development, and builds; the plugin's helpers orchestrate the Sites lifecycle
- `dist/` contains generated deployment output; `.vinext/`, `.wrangler/`, and `.sites-runtime/` contain ignored local tool state
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

## V4.0 — 달력 근무시간 입력

월간 스케줄의 날짜 + 버튼 또는 직원 일정을 눌러 출퇴근 시각과 휴게시간을 입력합니다. 입력창에서도 달력으로 날짜를 선택하며, 예정 근무시간은 휴게를 제외해 표시합니다. 휴대폰에서 한 주 7일을 함께 표시합니다.

사용자 안내: 프로그램 링크를 안내할 때 항상 현재 제품 버전(V4.5)을 함께 표기합니다. 제품 버전과 Sites 저장 버전 번호는 별개입니다.

## V4.1 — 기본 근무시간과 날짜별 복사

새 스케줄과 반복 스케줄은 퇴근 22:30, 휴게 30분으로 시작합니다. 기존 일정 편집은 저장된 값을 유지합니다. 하루 일정 입력창에서 다른 날짜에 복사를 누르고 대상 직원·여러 날짜를 선택해 복사합니다. 기존 일정 덮어쓰기는 별도 선택하며 실제 출퇴근 기록과 마감월은 보호합니다. 여러 날짜 중 하나라도 검증에 실패하면 전체 복사가 취소됩니다.

## V4.2 — 15개월 시뮬레이션 및 성능 개선

예정기록 확정과 실제 출퇴근 기록의 시간 중복을 차단합니다. 한국 날짜 변환과 월별 근무 집계를 개선하고, 한 번의 급여 계산에서 월별 결과를 공유해 중복 계산을 줄입니다. 캐시는 해당 계산에만 사용해 수정 후 결과가 오래 남지 않습니다.

테스트: `node tests/stress-15-months.mjs` (Node 24의 인메모리 SQLite, 가상 시간). 상세 결과는 `docs/stress-test-report.md`와 `docs/stress-test-results.json`. 테스트는 실제 서버와 직원 데이터를 읽거나 쓰지 않습니다.

## V4.5 — 달력 아래쪽 클릭과 입력창 표시 보완

달력은 화면 높이 안에서 별도로 스크롤합니다. 근무 설정 입력창은 document.body에 포털로 생성한 네이티브 dialog의 최상위 레이어를 사용해 달력의 overflow와 겹침 영향을 받지 않습니다. 닫기·Esc·배경 클릭 후 원래 항목으로 포커스가 돌아갑니다. 일정 버튼에는 날짜·직원이 포함된 접근성 이름을 제공합니다. 저장된 스케줄이나 실제 출퇴근 데이터는 변경하지 않습니다.

## 매월 말일 지급일

사업장 설정의 임금 지급일은 매월 말일로 고정합니다. 기존 숫자 지급일은 현재 설정 조회 시 말일 정책으로 표시되며 관리자 설정 저장 시 month_end로 저장합니다. 직원 명세서와 새 계약서 초안에도 말일을 반영합니다. 이미 작성된 계약서와 마감 급여 금액은 변경하지 않습니다. 명세서에 표시한 지급예정일은 실제 이체 완료를 의미하지 않습니다.

## 소득세·지방소득세 참고 자동계산

관리자 → 급여 정산 → 검토에서 세금 계산 방식을 선택합니다.
- 근로소득 등은 확인한 세액을 직접 입력합니다. 입력한 소득세의 10%로 지방소득세를 계산하는 버튼을 제공합니다.
- 원천징수 대상 사업소득으로 확인한 경우에만 `사업소득 해당자 — 3.3% 참고 자동계산`을 선택하고 해당 여부를 확인합니다.
- 실제 근태 기반 기본급 + 반영된 주휴수당 + 추가수당 전체를 기준으로 소득세 3%, 소득세의 10%를 지방소득세로 계산합니다. 가불·기타 공제를 빼서 세금 기준액을 줄이지 않습니다. 각 세목은 10원 미만을 버리는 참고 계산입니다.
- 수당·주휴시간 변경을 반영하며, 저장할 때 서버가 실제 데이터로 재계산합니다. 직원의 근태·소득 분류·신고자료 분류를 자동 변경하지 않습니다.
- 월 총액 참고 계산으로, 지급 건별 원천징수 및 최종 신고세액은 확인해야 합니다. 신고나 송금을 자동 실행하지 않습니다.

계산 근거: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7902 및 https://j.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=238925&mi=40349


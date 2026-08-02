# 식물talk

아이들이 식물을 관찰하고 기록하며 AI 식물 캐릭터와 대화하는 Vite 앱입니다.

## 공개 배포 보안 구조

- 교사 또는 보호자가 자신의 OpenAI API 키를 입력합니다. AI 사용량과 비용은
  해당 OpenAI 계정에 적용되며 운영자의 공용 키는 사용하지 않습니다.
- 입력한 키는 서버가 OpenAI에 연결 가능한지 확인한 뒤 AES-256-GCM으로
  암호화합니다. 암호문은 현재 서명 세션에 묶인 HttpOnly, Secure,
  SameSite=Strict 쿠키로만 브라우저에 보관합니다.
- 키 원문과 암호문을 앱 데이터베이스에 저장하지 않으며 브라우저 JavaScript도
  연결 후 키를 읽을 수 없습니다. 세션은 12시간 뒤 만료됩니다.
- 선생님 또는 보호자가 개인정보 안내를 확인하면 12시간 유효한 서명 세션을
  HttpOnly, Secure, SameSite=Strict 쿠키로 발급합니다.
- 모든 AI API는 동일 출처, 세션, 요청 크기와 Upstash Redis 사용량 제한을
  통과해야 합니다.
- 세션별, IP별, 분당, 서비스 전체 일일 예산을 각각 제한합니다.
- OpenAI Responses API 호출은 `store: false`로 실행합니다.
- 관찰 기록, 아이 이름과 사진은 앱 서버에 저장하지 않고 현재 브라우저에만
  보관합니다.
- 최초 사용 시 교사 비밀번호를 설정합니다. 원문 대신 PBKDF2-SHA-256 해시만
  현재 브라우저에 저장하며, 분석·AI 키·식물 및 아이 명단 관리·삭제 기능은
  교사 확인 후 10분 동안만 열립니다.
- CSP, HSTS, frame 차단, 권한 정책 등의 응답 헤더를 Vercel에서 적용합니다.

## 필수 환경 변수

Vercel 프로젝트의 `Settings > Environment Variables`에서 아래 값을
Production, Preview, Development에 설정합니다.

```text
SESSION_SECRET
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

현재 Vercel Marketplace 연동이 아래 이름을 자동 생성한 경우에도 그대로
동작합니다.

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

`SESSION_SECRET`은 다음 명령으로 생성할 수 있습니다.

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Upstash Redis는 Vercel Marketplace에서 프로젝트에 연결하면 Redis URL과 토큰이
`KV_REST_API_*` 또는 `UPSTASH_REDIS_REST_*` 이름으로 자동 추가됩니다. Redis
토큰을 브라우저 코드나 `VITE_*` 환경 변수에 넣지 마세요.

운영자용 `OPENAI_API_KEY` 환경 변수는 필요하지 않습니다. 이전 방식에서 등록한
값이 있다면 Vercel에서 삭제해도 됩니다. 사용자는 교사·보호자 동의 화면 다음에
자신의 키를 입력하며, 키는 [OpenAI API 키 페이지](https://platform.openai.com/api-keys)에서
만들 수 있습니다.

프로덕션 주소를 고정하려면 다음 값도 설정합니다.

```text
APP_ALLOWED_ORIGINS=https://plant-speaks.vercel.app
```

`APP_ACCESS_CODE`는 선택 사항입니다. 비워 두면 보호자·교사 동의 후 누구나
세션을 만들 수 있고, 값을 넣으면 참여 코드를 아는 사용자만 시작할 수 있습니다.

전체 예시는 [`.env.example`](./.env.example)에 있습니다.

## 기본 AI 제한

| 기능 | 세션별 일일 제한 | 예산 단위 |
| --- | ---: | ---: |
| 대화 | 30회 | 1 |
| 사진 분석 | 12회 | 5 |
| 식물 정보 생성 | 8회 | 3 |
| AI 읽어주기 | 30회 | 2 |

서비스 전체 기본 예산은 하루 600단위이고 IP별 기본 예산은 하루 200단위입니다.
세션 생성도 IP당 시간당 10회로 제한합니다. 모든 값은 환경 변수로 낮출 수
있습니다. 이 제한은 Vercel·Redis 자원과 공개 서비스를 보호하기 위한 것이며,
OpenAI 청구 한도는 각 사용자가 자신의 OpenAI 계정에서 별도로 관리합니다.
Redis가 연결되지 않은 프로덕션에서는 AI 요청을 안전하게 거부합니다. 앱에
표시되는 사용 횟수는 현재 기기의 기능별 횟수이며 OpenAI 청구 금액과 같지
않습니다.

## 검사

```powershell
npm run build
npm run test:security
npm audit --omit=dev
```

## 배포

`master` 브랜치를 GitHub에 push하면 연결된 Vercel 프로젝트가 자동으로
배포됩니다. 보안 환경 변수를 변경한 경우 `Deployments > Redeploy`를 실행해야
런타임에 반영됩니다. Vercel과 Upstash 무료 플랜 한도 안에서는 운영자가 별도
호스팅 비용 없이 공유할 수 있고, OpenAI API 사용 비용은 각 키 소유자에게
적용됩니다.

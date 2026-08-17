# I am the Seouler

`iamtheseouler.com` — Eleventy 로 만든 정적 사이트, Vercel 이 GitHub `main` 을 보고 자동 배포합니다.

## 글 쓰는 법

`iamtheseouler.com/admin` 에서 GitHub 로 로그인하면 됩니다. 저장하면 곧바로
`main` 에 커밋되고 1~2분 뒤 사이트에 반영됩니다.

글 하나는 파일 하나(`src/posts/*.md`)이고, 그 안에 영문·한글 본문이 함께 들어
있습니다. 사이트의 EN/한글 토글이 이 두 벌을 전환합니다.

본문에서 지켜야 할 것 두 가지:

- 소제목은 `### 1. 제목` 처럼 번호를 붙입니다. 번호가 회색 이탤릭으로 표시됩니다.
- 사진은 영문·한글 본문에 같은 순서, 같은 파일로 넣습니다.

## 사진과 갤러리

사진은 전부 어느 글엔가 속합니다. 본문에 넣은 사진이거나, 그 글의
**다 싣지 못한 사진**이거나 둘 중 하나입니다. 따로 도는 사진 목록은 없습니다.

- **다 싣지 못한 사진** — `/admin` 에서 글 맨 아래 항목. 글 끝에 옆으로
  넘겨보는 줄로 붙습니다.
- **`/gallery`** — 위 둘을 전부 모아 최신 글부터 보여줍니다. 상단 버튼으로
  글별로 좁힐 수 있고, 사진을 누르면 크게 보이면서 그 글로 가는 길이 뜹니다.

한 줄 설명은 갤러리에서만 보입니다. 본문에 넣은 사진에 설명을 달고 싶으면
사진 삽입창의 **Title** 칸을 채우세요. 에세이 안에서는 보이지 않고 갤러리에서만
나옵니다.

사진 설명(alt)은 화면에 보이지 않지만 꼭 채우세요. 화면 낭독기와 검색이
읽는 것은 그것뿐입니다.

필터 버튼에 뜨는 이름은 **머리 표시(영문)** 의 가운뎃점 뒤쪽을 씁니다.
`Aug 2026 · Jeongdong` 이면 버튼은 `Jeongdong` 이 됩니다.

## 폴더

```
src/posts/*.md        글. 이 파일만 고치면 됩니다
src/posts/posts.json  글이 /주소.html 로 나가도록 하는 설정
src/_includes/        페이지 틀 (base = 공통, post = 글 페이지)
src/index.njk         홈. Journal 카드는 글에서 자동 생성됩니다
src/_data/site.json   이메일, 애널리틱스 토큰, 반복 문구
src/_data/upcoming.json  Journal 의 "Coming soon" 자리표시자
src/_data/gallery.json   갤러리 사진 목록
src/gallery.njk       갤러리 페이지
src/_includes/nav.njk 상단 메뉴 (모든 페이지가 이 파일 하나를 씁니다)
src/css/site.css      사이트 전체 스타일 한 벌
src/admin/            /admin 화면 (Sveltia CMS)
api/                  /admin 로그인용 GitHub OAuth 함수 2개
src/photos/           사진 원본
```

## 사진은 자동으로 줄여서 내보냅니다

원본은 그대로 두고, 빌드할 때 avif·webp·jpeg로 여러 크기를 만들어 브라우저가
화면에 맞는 것을 고르게 합니다. 갤러리 기준 7.7MB → 360KB.

형식은 webp 와 jpeg 두 가지입니다. avif 도 만들 수 있고 파일이 절반으로
줄지만, 만드는 데 서른 배가 걸려서 저장 후 반영까지 4분이 됩니다. 글을
자주 고치는 동안은 그 4분이 더 비쌉니다. 발행이 뜸해지면 `.eleventy.js` 의
`formats` 에 `"avif"` 를 도로 넣으세요.

## 직접 손대야 할 때

```bash
npm install
npm start     # http://localhost:8080
npm run build # _site/ 에 결과물
```

## 설정값이 어디 있나

- **Vercel 환경변수** — `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.
  `/admin` 로그인에 쓰입니다. 바꾸면 재배포해야 적용됩니다.
- **GitHub OAuth App** — 이름 `The Seouler Admin`. Redirect URI 는 www 와
  apex 둘 다 등록되어 있어야 합니다. 토큰을 끊고 싶으면 이 앱에서
  `Revoke all user tokens` 를 누르면 됩니다.
- **DNS** — Cloudflare. 모든 레코드는 Proxy 를 끈 상태(DNS only)로 둡니다.
- **애널리틱스** — Cloudflare Web Analytics + Microsoft Clarity. 토큰은
  `src/_data/site.json` 에 있고 모든 페이지에 자동으로 들어갑니다.

## 알아둘 것

한글 웹폰트는 라틴 폰트와 **분리해서** 요청합니다. 한 요청에 묶으면 한글
서브셋만 로딩되지 않는 경우가 실제로 있었습니다. `src/_includes/base.njk` 의
`<link>` 두 줄을 하나로 합치지 마세요.

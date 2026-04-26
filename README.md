# Intooni

Intooni는 인스타툰 작가를 장르, 해시태그, 팔로워 기준으로 탐색하고, 어드민 화면에서 작가 데이터를 관리할 수 있는 Next.js 14 프로젝트입니다.

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Supabase Database + Storage
- `@hello-pangea/dnd` for admin drag-and-drop

## Local Run

1. 의존성 설치

```bash
npm install
```

2. `.env.local` 파일 생성

프로젝트 루트에 `.env.local` 파일을 만들고 아래 값을 넣습니다.

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
ADMIN_PASSWORD=your-admin-password
```

3. 개발 서버 실행

PowerShell에서는 아래처럼 실행하면 됩니다.

```bash
npm.cmd run dev
```

4. 브라우저 접속

- 사용자 페이지: `http://localhost:3000`
- 관리자 로그인: `http://localhost:3000/admin/login`

## Supabase 연결 방법

1. Supabase 프로젝트를 생성합니다.
2. Supabase SQL Editor에서 [supabase/schema.sql](/C:/Users/user/Desktop/Instoon/supabase/schema.sql)을 실행합니다.
3. `artist-images` 퍼블릭 버킷이 생성되었는지 확인합니다.
4. Settings > API에서 Project URL과 publishable key 또는 anon key를 복사합니다.
5. 위 값을 `.env.local`에 넣습니다.

## 관리자 로그인

- 관리자 비밀번호는 코드에 하드코딩되어 있지 않습니다.
- `.env.local`의 `ADMIN_PASSWORD` 값을 사용합니다.
- 로그인 성공 시 브라우저 `localStorage`가 아니라 서버 쿠키로 세션을 유지합니다.

## 배포 방법 (Vercel)

1. Git 저장소를 Vercel에 연결합니다.
2. Environment Variables에 아래 값을 등록합니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ADMIN_PASSWORD`
3. Framework Preset은 Next.js로 둡니다.

## 프로젝트 구조

```text
app/
  admin/
    login/page.tsx
    page.tsx
  api/
    admin/
      login/route.ts
      logout/route.ts
      session/route.ts
    artists/route.ts
  globals.css
  layout.tsx
  page.tsx
components/
  admin/
    ArtistForm.tsx
    ArtistTable.tsx
  ArtistCard.tsx
  ArtistModal.tsx
  FilterBar.tsx
  InstagramEmbed.tsx
  SearchBar.tsx
lib/
  admin-auth.ts
  supabase.ts
  types.ts
supabase/
  schema.sql
```

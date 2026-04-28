import type { Metadata } from "next";
import { Noto_Sans_KR, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import "@/app/globals.css";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans"
});

const notoKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-kr"
});

const siteUrl = getSiteUrl();
const ogImageUrl = `${siteUrl}/og-home.png`;
const defaultTitle = `${SITE_NAME} | 모든 인스타툰, 한 곳에서 발견하세요`;
const defaultDescription =
  "그 계정 뭐였지..? 아이디가 안 떠올라도 떠오르는 키워드로 찾아봐요!";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: defaultTitle,
  description: defaultDescription,
  applicationName: SITE_NAME,
  keywords: [
    "인투니",
    "인스타툰",
    "인스타툰 디렉토리",
    "인스타툰 찾기",
    "인스타툰 찾는 법",
    "인스타툰 추천",
    "썰툰",
    "육아툰",
    "직장툰",
    "연애툰"
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: SITE_NAME,
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "인투니 공유 이미지"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [ogImageUrl]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${jakartaSans.variable} ${notoKr.variable}`}>
      <body
        className="antialiased"
        style={{
          fontFamily:
            "var(--font-kr), var(--font-sans), -apple-system, BlinkMacSystemFont, sans-serif"
        }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}

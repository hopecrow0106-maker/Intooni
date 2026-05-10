import type { Metadata } from "next";
import Script from "next/script";
import { Noto_Sans_KR, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import "@/app/globals.css";
import { ADSENSE_ENABLED } from "@/lib/adsense";
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
const ogImageUrl = `${siteUrl}/intoonismall.png`;
const defaultTitle = `${SITE_NAME} | 기억 안 나는 인스타툰 찾기`;
const defaultDescription =
  "작가 이름이 생각 안 날 때, 해시태그와 키워드로 인스타툰 작가를 찾아보세요. 썰툰, 일상툰, 연애툰부터 랜덤 추천까지 한 곳에서 발견해요.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: defaultTitle,
  description: defaultDescription,
  applicationName: SITE_NAME,
  icons: {
    icon: [{ url: "/intoonismall.png", type: "image/png" }],
    shortcut: [{ url: "/intoonismall.png", type: "image/png" }],
    apple: [{ url: "/intoonismall.png", type: "image/png" }]
  },
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
        width: 912,
        height: 912,
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
        {ADSENSE_ENABLED ? (
          <Script
            id="adsense-script"
            async
            strategy="afterInteractive"
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8362832465607393"
            crossOrigin="anonymous"
          />
        ) : null}
        <Analytics />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Noto_Sans_KR, Plus_Jakarta_Sans } from "next/font/google";

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

const defaultTitle = `${SITE_NAME} | 인스타툰 디렉토리`;
const defaultDescription =
  "인스타툰 작가를 해시태그와 카테고리로 쉽게 찾고, 매거진으로 새 작가를 발견하는 인스타툰 디렉토리 서비스.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: defaultTitle,
  description: defaultDescription,
  applicationName: SITE_NAME,
  keywords: [
    "인투니",
    "인스타툰",
    "인스타툰 디렉토리",
    "웹툰 작가",
    "인스타툰 추천",
    "툰 작가 검색"
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: SITE_NAME,
    title: defaultTitle,
    description: defaultDescription
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription
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
      </body>
    </html>
  );
}


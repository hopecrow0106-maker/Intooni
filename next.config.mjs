import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const remotePatterns = [
  {
    protocol: "https",
    hostname: "placehold.co"
  },
  {
    protocol: "https",
    hostname: "**.cdninstagram.com"
  },
  {
    protocol: "https",
    hostname: "**.fbcdn.net"
  }
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (supabaseUrl) {
  try {
    const { hostname } = new URL(supabaseUrl);
    remotePatterns.push({
      protocol: "https",
      hostname
    });
  } catch {
    // Ignore malformed env values so local dev config still loads.
  }
}

/** @type {import('next').NextConfig} */
const createNextConfig = (phase) => ({
  // Keep local HMR output separate from production builds. Running `next build`
  // while the dev server is open can otherwise leave webpack chunks out of sync.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  images: {
    remotePatterns
  }
});

export default createNextConfig;

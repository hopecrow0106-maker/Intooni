const remotePatterns = [
  {
    protocol: "https",
    hostname: "placehold.co"
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
const nextConfig = {
  images: {
    remotePatterns
  }
};

export default nextConfig;

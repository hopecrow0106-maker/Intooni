const CANONICAL = "https://intooni.com";
const WWW = "https://www.intooni.com";
const VERCEL = "https://intooni.vercel.app";
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  return { response, text: await response.text() };
}

async function checkRedirect(origin, label) {
  const path = "/magazine?deployment_gate=1";
  const response = await fetch(`${origin}${path}`, { redirect: "manual" });
  const location = response.headers.get("location");
  if (![307, 308].includes(response.status) || location !== `${CANONICAL}${path}`) {
    fail(`${label} redirect expected 307/308 -> ${CANONICAL}${path}, got ${response.status} -> ${location}`);
    return;
  }
  pass(`${label} permanent canonical redirect`);
}

async function main() {
  await Promise.all([checkRedirect(WWW, "www"), checkRedirect(VERCEL, "Vercel host")]);

  const [{ response: homeResponse, text: home }, { response: sitemapResponse, text: sitemap }] =
    await Promise.all([fetchText(CANONICAL), fetchText(`${CANONICAL}/sitemap.xml`)]);
  if (homeResponse.status !== 200) fail(`canonical home returned ${homeResponse.status}`);
  else pass("canonical home returns 200");
  const homeArtistLinks = (home.match(/href=["']\/artists\//g) ?? []).length;
  if (homeArtistLinks < 1) fail("home initial HTML has no /artists/ detail links");
  else pass(`home initial HTML contains ${homeArtistLinks} artist links`);

  if (sitemapResponse.status !== 200) fail(`sitemap returned ${sitemapResponse.status}`);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const invalidSitemapUrls = urls.filter((url) => !url.startsWith(`${CANONICAL}/`));
  if (urls.length === 0 || invalidSitemapUrls.length > 0) {
    fail(`sitemap host mismatch or empty: ${invalidSitemapUrls.slice(0, 3).join(", ")}`);
  } else {
    pass(`sitemap contains ${urls.length} canonical URLs`);
  }

  const artistUrl =
    process.env.PRODUCTION_ARTIST_URL || urls.find((url) => url.startsWith(`${CANONICAL}/artists/`));
  if (!artistUrl) {
    fail("no public artist URL was found in sitemap; set PRODUCTION_ARTIST_URL if needed");
  } else {
    const { response, text } = await fetchText(artistUrl);
    if (response.status !== 200) fail(`artist detail returned ${response.status}: ${artistUrl}`);
    const canonicalMatch = text.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
    const ogMatch = text.match(/<meta property="og:url" content="([^"]+)"/i)?.[1];
    if (canonicalMatch !== artistUrl) fail(`artist canonical mismatch: ${canonicalMatch}`);
    else pass("artist canonical URL matches canonical host and handle");
    if (ogMatch !== artistUrl) fail(`artist og:url mismatch: ${ogMatch}`);
    else pass("artist og:url matches canonical URL");

    const forbidden = [
      "internal_memo",
      "dm_available",
      "brand_safety_grade",
      "recommended_brand_categories",
      "협업 이력",
      "내부 운영 메모"
    ];
    const exposed = forbidden.filter((value) => text.includes(value));
    if (exposed.length > 0) fail(`artist HTML exposes forbidden markers: ${exposed.join(", ")}`);
    else pass("artist HTML has no forbidden internal markers");
  }

  if (failures.length > 0) {
    console.error(`\nProduction verification failed (${failures.length} gate(s)).`);
    process.exitCode = 1;
  } else {
    console.log("\nProduction verification passed.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

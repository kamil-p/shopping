import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libsql ships a native addon (prebuilt) and must not be bundled.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;

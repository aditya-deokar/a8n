import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  async redirects(){
    return[
      {
        source: "/",
        destination:"/workflows",
        permanent:false
      }
    ]
  }

  
};

export default nextConfig;

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sweepr — Office Pool, Automated",
    short_name: "Sweepr",
    description:
      "Create a World Cup sweepstakes pool, share a link, and let the smart contract settle the payout. No trust. No spreadsheets. Just vibes.",
    start_url: "/",
    display: "standalone",
    background_color: "#0F1A0F",
    theme_color: "#0F1A0F",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}

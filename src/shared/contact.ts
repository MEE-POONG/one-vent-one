import { z } from "zod";

export const socialChannels = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "website", label: "เว็บไซต์" },
] as const;
const socialUrl = z.union([
  z.literal(""),
  z.url({ protocol: /^https$/ }).max(500),
]);
export const contactInput = z.object({
  phone: z.string().trim().max(100),
  line: z.string().trim().max(100),
  email: z.union([z.literal(""), z.email().max(200)]),
  address: z.string().trim().max(500),
  facebook: socialUrl,
  instagram: socialUrl,
  tiktok: socialUrl,
  youtube: socialUrl,
  website: socialUrl,
});
export function publicSocialLinks(contact?: Record<string, unknown>) {
  return socialChannels.flatMap((channel) => {
    const url = contact?.[channel.key];
    return typeof url === "string" &&
      /^https:\/\//i.test(url) &&
      socialUrl.safeParse(url).success
      ? [{ ...channel, url }]
      : [];
  });
}

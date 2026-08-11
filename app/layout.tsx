import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./friendly.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og.png`;

  return {
    title: {
      default: "Project Workspace",
      template: "%s · Project Workspace",
    },
    description:
      "Plan projects, milestones, assignments, deliverables, and reminders in one clear team workspace.",
    applicationName: "Project Workspace",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/icon-192.png",
      apple: "/icon-192.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Project Workspace",
    },
    formatDetection: { telephone: false },
    openGraph: {
      title: "Project Workspace",
      description:
        "A focused project-management workspace for teams of every kind.",
      type: "website",
      images: [{ url: socialImage, width: 1536, height: 1024 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Project Workspace",
      description:
        "Projects, milestones, tasks, deliverables, and reminders in one clear workspace.",
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#2563EB",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/PlusJakartaSans-Variable.ttf?v=20260811"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

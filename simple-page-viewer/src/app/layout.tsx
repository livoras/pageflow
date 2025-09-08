import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SimplePage Viewer",
  description: "View SimplePage recordings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

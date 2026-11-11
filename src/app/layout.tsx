import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DriveC | Professional Driver Bookings & Self-Drive Car Rentals Kochi",
  description: "One premium website for professional driver bookings (for your own car) and approved self-drive car rentals in Kochi, Kerala. Zero surge pricing, digital handover inspections, and verified safety.",
  keywords: [
    "DriveC",
    "DriveC Kochi",
    "professional driver booking Kochi",
    "act driver Kochi",
    "self-drive car rental Kochi",
    "rent a car Kochi",
    "driver for own car Kerala",
    "Kochi airport driver",
    "Ernakulam car rental"
  ],
  authors: [{ name: "DriveC Mobility Team" }],
  openGraph: {
    title: "DriveC | Professional Driver Bookings & Self-Drive Car Rentals",
    description: "Book qualified professional drivers for your car or rent approved self-drive cars in Kochi, Kerala.",
    type: "website",
    locale: "en_IN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-[#090a0f] text-[#f5f5f7]">
        {children}
      </body>
    </html>
  );
}

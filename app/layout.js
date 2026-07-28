import "./globals.css";

export const metadata = {
  title: "Daily Quests",
  description: "Chore and allowance tracker for Zach and Kyle",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

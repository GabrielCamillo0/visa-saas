import "./globals.css";
import type { ReactNode } from "react";


export default function RootLayout({ children }: { children: ReactNode }) {
return (
<html lang="pt-BR">
<body>
<main className="min-h-screen bg-gray-50 text-gray-900">{children}</main>
</body>
</html>
);
}
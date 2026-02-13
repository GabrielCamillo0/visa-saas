import type { ReactNode } from "react";

export default function DashLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container-app py-6 sm:py-8">
      {children}
    </div>
  );
}
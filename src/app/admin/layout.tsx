import { getStore } from "@/config/store";
import "./workspace.css";

export const metadata = {
  title: { default: "მართვის პანელი", template: "%s · მართვის პანელი" },
  description: "მაღაზიის ადმინისტრირება",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-workspace">
    <a href="#admin-content" className="skip-link">შიგთავსზე გადასვლა</a>
    <header className="admin-bar"><span>მართვის პანელი</span><span>{getStore().name}</span></header>
    {children}
  </div>;
}

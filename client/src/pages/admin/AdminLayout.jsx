import { Outlet } from "react-router-dom";
import Navbar from "@/components/navbar";

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 px-6 py-8 md:px-12 md:py-10">
        <div className="w-full max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

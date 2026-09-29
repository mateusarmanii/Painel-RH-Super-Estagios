import { useState } from "react";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

function Layout({ activeItem, children, onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-brand-light text-brand-dark">
      <Sidebar
        activeItem={activeItem}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="min-h-screen">
        <Topbar activeItem={activeItem} onLogout={onLogout} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;
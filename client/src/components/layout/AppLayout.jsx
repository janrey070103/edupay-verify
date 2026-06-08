import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);
  const openSidebar = () => setSidebarOpen(true);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7fb] font-sans antialiased text-gray-900">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
          aria-label="Close menu backdrop"
        />
      )}

      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={openSidebar} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;

import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);
  const openSidebar = () => setSidebarOpen(true);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f7f6] font-sans antialiased text-gray-900 print:block print:h-auto print:overflow-visible print:bg-white">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
          aria-label="Close menu backdrop"
        />
      )}

      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        <Header onMenuClick={openSidebar} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 print:overflow-visible print:p-0">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;

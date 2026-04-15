import { useState } from "react";
import { ChatPane } from "@/components/Chat/ChatPane";
import { Sidebar } from "@/components/Sidebar/Sidebar";

export function AppShell() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen bg-bg" data-testid="app-shell">
      {/* Main column: mobile top bar + chat */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with hamburger. Hidden on md+. */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2 md:hidden">
          <span className="text-base font-bold text-text">Bazak</span>
          <button
            type="button"
            aria-label="Open conversations"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-text hover:bg-surface-muted"
            data-testid="open-sidebar-button"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M3 5h14M3 10h14M3 15h14"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <ChatPane />
        </div>
      </div>

      {/* Desktop sidebar (right side, per design doc §2.4). */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile slide-over */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" data-testid="mobile-sidebar-overlay">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            data-testid="mobile-sidebar-backdrop"
            aria-hidden="true"
          />
          <div className="absolute right-0 top-0 h-full">
            <Sidebar />
          </div>
        </div>
      )}
    </div>
  );
}

export default AppShell;

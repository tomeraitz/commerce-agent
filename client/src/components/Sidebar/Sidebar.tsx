import { BrandHeader } from "./BrandHeader";
import { ConversationList } from "./ConversationList";
import { NewChatButton } from "./NewChatButton";

export function Sidebar() {
  return (
    <aside
      className="flex h-full w-[280px] shrink-0 flex-col border-l border-border bg-surface-muted"
      data-testid="sidebar"
    >
      <BrandHeader />
      <div className="px-4 pb-3">
        <NewChatButton />
      </div>
      <div className="flex-1 overflow-y-auto">
        <ConversationList />
      </div>
    </aside>
  );
}

export default Sidebar;

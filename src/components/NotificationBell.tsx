import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/use-notifications";
import { useNavigate } from "@tanstack/react-router";
import { dateTimeBR } from "@/lib/format";

export function NotificationBell() {
  const navigate = useNavigate();
  const { data = [], unreadCount, markRead, markAllRead } = useNotifications();

  const handleOpen = (id: string, link?: string | null) => {
    markRead.mutate(id);
    if (link) navigate({ to: link });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div className="font-semibold text-sm">Notificações</div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => markAllRead.mutate()}>
              <CheckCheck className="h-3 w-3" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {data.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sem notificações.</div>
          ) : (
            <div className="divide-y">
              {data.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleOpen(n.id, n.link_to)}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${!n.read_at ? "bg-blue-50/60" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-600 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-sm">{n.title}</div>
                        {n.type === "lead_handoff" && <Badge variant="secondary" className="text-[10px]">Novo lead</Badge>}
                      </div>
                      {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1">{dateTimeBR(n.created_at)}</div>
                    </div>
                    {!n.read_at && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id); }}
                        className="text-muted-foreground hover:text-foreground shrink-0 inline-flex items-center justify-center"
                        title="Marcar como lida"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

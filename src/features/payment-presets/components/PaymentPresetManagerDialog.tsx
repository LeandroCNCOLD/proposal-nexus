import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit3, Loader2, Power } from "lucide-react";
import { toast } from "sonner";
import {
  usePaymentPresets,
  useTogglePaymentPresetActive,
} from "../use-payment-presets";
import {
  PaymentPresetFormDialog,
  type PresetFormValues,
} from "./PaymentPresetFormDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentPresetManagerDialog({ open, onOpenChange }: Props) {
  const { data, isLoading } = usePaymentPresets(false);
  const toggle = useTogglePaymentPresetActive();
  const [editing, setEditing] = useState<PresetFormValues | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const handleEdit = (presetId: string) => {
    const p = data?.find((pp) => pp.id === presetId);
    if (!p) return;
    setEditing({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      is_active: p.is_active,
      installments: p.installments.map((i) => ({
        description: i.description,
        percentage: Number(i.percentage),
        days: i.days,
      })),
    });
    setEditOpen(true);
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await toggle.mutateAsync({ id, is_active: active });
      toast.success(active ? "Preset ativado." : "Preset inativado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao alterar status.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar condições de pagamento</DialogTitle>
            <DialogDescription>
              Selecione um preset para editar suas parcelas, ou ative/inative.
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          )}

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {data?.map((p) => (
              <div
                key={p.id}
                className="rounded-md border p-3 flex items-start gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    {p.is_active ? (
                      <Badge variant="default">Ativo</Badge>
                    ) : (
                      <Badge variant="outline">Inativo</Badge>
                    )}
                    <Badge variant="secondary">{p.installments.length} parcelas</Badge>
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(p.id)}
                  >
                    <Edit3 className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggle(p.id, !p.is_active)}
                    disabled={toggle.isPending}
                  >
                    <Power className="h-4 w-4 mr-1" />
                    {p.is_active ? "Inativar" : "Ativar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <PaymentPresetFormDialog
        open={editOpen}
        mode="edit"
        initial={editing}
        onOpenChange={setEditOpen}
      />
    </>
  );
}

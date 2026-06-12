import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchAgenda, criarAgendamento, confirmarPresenca,
  TIPOS_REUNIAO, STATUS_REUNIAO, CORES_TIPO,
  type AgendaItem,
} from '@/modules/crm/services-agenda';
import { useSdrNames, useCloserNames } from '@/modules/sdr/hooks/use-team-members';

export const Route = createFileRoute('/app/agenda')({
  component: AgendaPage,
});

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7..20

type View = 'dia' | 'semana' | 'mes';

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), 1); return x; }
function endOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); return x; }

function fmtDate(d: Date) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function AgendaPage() {
  const [view, setView] = useState<View>('dia');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [filterCloser, setFilterCloser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [newOpen, setNewOpen] = useState(false);
  const [prefill, setPrefill] = useState<Partial<AgendaItem> | null>(null);
  const navigate = useNavigate();
  const { names: closerNames } = useCloserNames();

  const range = useMemo(() => {
    if (view === 'dia') return { ini: startOfDay(cursor), fim: endOfDay(cursor) };
    if (view === 'semana') {
      const ini = startOfWeek(cursor);
      return { ini, fim: endOfDay(addDays(ini, 6)) };
    }
    return { ini: startOfMonth(cursor), fim: endOfMonth(cursor) };
  }, [view, cursor]);

  const { data: items = [] } = useQuery({
    queryKey: ['agenda', range.ini.toISOString(), range.fim.toISOString(), filterCloser, filterStatus],
    queryFn: () => fetchAgenda({
      inicio: range.ini.toISOString(),
      fim: range.fim.toISOString(),
      closer: filterCloser === 'all' ? undefined : filterCloser,
      status: filterStatus === 'all' ? undefined : filterStatus,
    }),
  });

  const { data: hoje = [] } = useQuery({
    queryKey: ['agenda-hoje'],
    queryFn: () => fetchAgenda({
      inicio: startOfDay(new Date()).toISOString(),
      fim: endOfDay(new Date()).toISOString(),
    }),
  });

  function navPrev() {
    if (view === 'dia') setCursor(addDays(cursor, -1));
    else if (view === 'semana') setCursor(addDays(cursor, -7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  }
  function navNext() {
    if (view === 'dia') setCursor(addDays(cursor, 1));
    else if (view === 'semana') setCursor(addDays(cursor, 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-sm text-muted-foreground capitalize">{fmtDate(cursor)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
          <Select value={view} onValueChange={(v) => setView(v as View)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dia">Dia</SelectItem>
              <SelectItem value="semana">Semana</SelectItem>
              <SelectItem value="mes">Mês</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCloser} onValueChange={setFilterCloser}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Closer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos closers</SelectItem>
              {closerNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUS_REUNIAO.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setPrefill(null); setNewOpen(true); }} className="gap-1">
            <Plus className="h-4 w-4" /> Nova Reunião
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card>
          <CardContent className="p-2 md:p-4">
            {view === 'dia' && (
              <DayView
                date={cursor}
                items={items}
                onSlotClick={(date) => { setPrefill({ data_inicio: date.toISOString() }); setNewOpen(true); }}
                onItemClick={(it) => navigate({ to: '/app/agenda/$id', params: { id: it.id } })}
              />
            )}
            {view === 'semana' && (
              <WeekView
                start={startOfWeek(cursor)}
                items={items}
                onSlotClick={(date) => { setPrefill({ data_inicio: date.toISOString() }); setNewOpen(true); }}
                onItemClick={(it) => navigate({ to: '/app/agenda/$id', params: { id: it.id } })}
              />
            )}
            {view === 'mes' && (
              <MonthView
                cursor={cursor}
                items={items}
                onDayClick={(d) => { setCursor(d); setView('dia'); }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" /> Hoje ({hoje.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {hoje.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma reunião hoje.</p>}
            {hoje.map((it: any) => (
              <TodayCard key={it.id} item={it} />
            ))}
          </CardContent>
        </Card>
      </div>

      <NovaReuniaoSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        prefill={prefill}
      />
    </div>
  );
}

function TodayCard({ item }: { item: AgendaItem }) {
  const qc = useQueryClient();
  const confirm = useMutation({
    mutationFn: () => confirmarPresenca(item.id),
    onSuccess: () => {
      toast.success('Presença confirmada');
      qc.invalidateQueries({ queryKey: ['agenda'] });
      qc.invalidateQueries({ queryKey: ['agenda-hoje'] });
    },
  });
  const hora = new Date(item.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <Link to="/app/agenda/$id" params={{ id: item.id }} className="block">
      <div className={`rounded-md border-l-4 p-2 hover:bg-muted/50 ${CORES_TIPO[item.tipo] ?? ''}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums">{hora}</span>
          <Badge variant={item.status === 'Confirmado' ? 'default' : 'outline'} className="text-xs">{item.status}</Badge>
        </div>
        <p className="text-sm font-medium truncate">{item.client_name}</p>
        <p className="text-xs text-muted-foreground truncate">{item.tipo} • {item.closer_nome}</p>
        {!item.closer_confirmou && (
          <Button
            size="sm"
            variant="outline"
            className="mt-1 h-6 text-xs w-full"
            onClick={(e) => { e.preventDefault(); confirm.mutate(); }}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar
          </Button>
        )}
      </div>
    </Link>
  );
}

function DayView({
  date, items, onSlotClick, onItemClick,
}: {
  date: Date; items: AgendaItem[];
  onSlotClick: (d: Date) => void;
  onItemClick: (i: AgendaItem) => void;
}) {
  const dayStart = startOfDay(date);
  return (
    <div className="divide-y">
      {HOURS.map((h) => {
        const slot = new Date(dayStart); slot.setHours(h, 0, 0, 0);
        const slotEnd = new Date(dayStart); slotEnd.setHours(h + 1, 0, 0, 0);
        const inSlot = items.filter((it) => {
          const t = new Date(it.data_inicio);
          return t >= slot && t < slotEnd;
        });
        return (
          <div key={h} className="grid grid-cols-[60px_1fr] min-h-16">
            <div className="text-xs text-muted-foreground py-2 text-right pr-2">{String(h).padStart(2, '0')}:00</div>
            <div
              className="py-1 px-2 hover:bg-muted/30 cursor-pointer space-y-1"
              onClick={() => onSlotClick(slot)}
            >
              {inSlot.map((it) => (
                <div
                  key={it.id}
                  onClick={(e) => { e.stopPropagation(); onItemClick(it); }}
                  className={`rounded-md border-l-4 p-2 cursor-pointer hover:opacity-80 ${CORES_TIPO[it.tipo] ?? ''}`}
                >
                  <p className="text-xs font-semibold">
                    {new Date(it.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {it.tipo}
                  </p>
                  <p className="text-sm font-medium">{it.client_name}</p>
                  <p className="text-xs text-muted-foreground">{it.closer_nome}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekView({
  start, items, onSlotClick, onItemClick,
}: {
  start: Date; items: AgendaItem[];
  onSlotClick: (d: Date) => void;
  onItemClick: (i: AgendaItem) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
          <div />
          {days.map((d, i) => (
            <div key={i} className="text-center py-2 text-xs font-semibold">
              {dayNames[i]} {d.getDate()}/{d.getMonth() + 1}
            </div>
          ))}
        </div>
        {HOURS.map((h) => (
          <div key={h} className="grid grid-cols-[60px_repeat(7,1fr)] border-b min-h-14">
            <div className="text-xs text-muted-foreground py-1 text-right pr-2">{String(h).padStart(2, '0')}:00</div>
            {days.map((d, i) => {
              const slot = new Date(d); slot.setHours(h, 0, 0, 0);
              const slotEnd = new Date(d); slotEnd.setHours(h + 1, 0, 0, 0);
              const inSlot = items.filter((it) => {
                const t = new Date(it.data_inicio);
                return t >= slot && t < slotEnd;
              });
              return (
                <div
                  key={i}
                  className="border-l p-0.5 hover:bg-muted/30 cursor-pointer space-y-0.5"
                  onClick={() => onSlotClick(slot)}
                >
                  {inSlot.map((it) => (
                    <div
                      key={it.id}
                      onClick={(e) => { e.stopPropagation(); onItemClick(it); }}
                      className={`rounded border-l-2 px-1 py-0.5 text-xs cursor-pointer ${CORES_TIPO[it.tipo] ?? ''}`}
                    >
                      <div className="font-semibold truncate">{it.client_name}</div>
                      <div className="truncate opacity-80">{it.closer_nome}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthView({
  cursor, items, onDayClick,
}: {
  cursor: Date; items: AgendaItem[]; onDayClick: (d: Date) => void;
}) {
  const first = startOfMonth(cursor);
  const startGrid = addDays(first, -first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(startGrid, i));
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div>
      <div className="grid grid-cols-7 border-b">
        {dayNames.map((n) => (
          <div key={n} className="text-center py-2 text-xs font-semibold">{n}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inDay = items.filter((it) => {
            const t = new Date(it.data_inicio);
            return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth() && t.getDate() === d.getDate();
          });
          const isCurrentMonth = d.getMonth() === cursor.getMonth();
          const isToday = startOfDay(new Date()).getTime() === startOfDay(d).getTime();
          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              className={`border-b border-l min-h-24 p-1 cursor-pointer hover:bg-muted/30 ${!isCurrentMonth ? 'opacity-40' : ''} ${isToday ? 'bg-primary/5' : ''}`}
            >
              <div className={`text-xs font-semibold ${isToday ? 'text-primary' : ''}`}>{d.getDate()}</div>
              <div className="space-y-0.5 mt-1">
                {inDay.slice(0, 3).map((it) => (
                  <div key={it.id} className={`text-[10px] rounded px-1 truncate border-l-2 ${CORES_TIPO[it.tipo] ?? ''}`}>
                    {new Date(it.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {it.client_name}
                  </div>
                ))}
                {inDay.length > 3 && <div className="text-[10px] text-muted-foreground">+{inDay.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NovaReuniaoSheet({
  open, onOpenChange, prefill,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  prefill: Partial<AgendaItem> | null;
}) {
  const { names: closerNames } = useCloserNames();
  const { names: sdrNames } = useSdrNames();
  const qc = useQueryClient();
  const initialDate = prefill?.data_inicio
    ? new Date(prefill.data_inicio)
    : (() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d; })();

  const [form, setForm] = useState({
    client_name: prefill?.client_name ?? '',
    proposal_number: prefill?.proposal_number ?? '',
    pipeline_id: prefill?.pipeline_id ?? null,
    tipo: prefill?.tipo ?? 'Reunião de Apresentação',
    closer_nome: prefill?.closer_nome ?? 'Rafael',
    sdr_nome: prefill?.sdr_nome ?? '',
    contato_cliente: prefill?.contato_cliente ?? '',
    email_cliente: prefill?.email_cliente ?? '',
    telefone_cliente: prefill?.telefone_cliente ?? '',
    data: initialDate.toISOString().slice(0, 10),
    hora: initialDate.toTimeString().slice(0, 5),
    duracao_min: 60,
    local: '',
    link_reuniao: '',
    observacoes: '',
  });

  // re-sync when prefill changes
  useMemo(() => {
    if (prefill) {
      const d = prefill.data_inicio ? new Date(prefill.data_inicio) : initialDate;
      setForm((f) => ({
        ...f,
        client_name: prefill.client_name ?? f.client_name,
        proposal_number: prefill.proposal_number ?? f.proposal_number,
        pipeline_id: prefill.pipeline_id ?? f.pipeline_id,
        tipo: prefill.tipo ?? f.tipo,
        closer_nome: prefill.closer_nome ?? f.closer_nome,
        sdr_nome: prefill.sdr_nome ?? f.sdr_nome,
        data: d.toISOString().slice(0, 10),
        hora: d.toTimeString().slice(0, 5),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const create = useMutation({
    mutationFn: async () => {
      const inicio = new Date(`${form.data}T${form.hora}:00`);
      const fim = new Date(inicio.getTime() + form.duracao_min * 60_000);
      return criarAgendamento({
        client_name: form.client_name,
        proposal_number: form.proposal_number || null,
        pipeline_id: form.pipeline_id,
        tipo: form.tipo,
        status: 'Agendado',
        data_inicio: inicio.toISOString(),
        data_fim: fim.toISOString(),
        duracao_min: form.duracao_min,
        local: form.local || null,
        link_reuniao: form.link_reuniao || null,
        sdr_nome: form.sdr_nome || null,
        closer_nome: form.closer_nome,
        contato_cliente: form.contato_cliente || null,
        email_cliente: form.email_cliente || null,
        telefone_cliente: form.telefone_cliente || null,
        closer_confirmou: false,
        observacoes: form.observacoes || null,
        resultado: null,
        proxima_acao: null,
        data_proxima_acao: null,
      });
    },
    onSuccess: () => {
      toast.success('Reunião agendada! Lembrete será enviado 24h antes.');
      qc.invalidateQueries({ queryKey: ['agenda'] });
      qc.invalidateQueries({ queryKey: ['agenda-hoje'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao agendar'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Nova Reunião</SheetTitle>
          <SheetDescription>Agende uma reunião com cliente, closer e SDR.</SheetDescription>
        </SheetHeader>

        <div className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
            </div>
            <div>
              <Label>Nº Proposta</Label>
              <Input value={form.proposal_number} onChange={(e) => setForm({ ...form, proposal_number: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_REUNIAO.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Closer responsável</Label>
              <Select value={form.closer_nome} onValueChange={(v) => setForm({ ...form, closer_nome: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {closerNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>SDR que agendou</Label>
              <Select value={form.sdr_nome} onValueChange={(v) => setForm({ ...form, sdr_nome: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {sdrNames.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contato do cliente</Label>
              <Input value={form.contato_cliente} onChange={(e) => setForm({ ...form, contato_cliente: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email cliente</Label>
              <Input type="email" value={form.email_cliente} onChange={(e) => setForm({ ...form, email_cliente: e.target.value })} />
            </div>
            <div>
              <Label>Telefone cliente</Label>
              <Input value={form.telefone_cliente} onChange={(e) => setForm({ ...form, telefone_cliente: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
            </div>
            <div>
              <Label>Duração</Label>
              <Select value={String(form.duracao_min)} onValueChange={(v) => setForm({ ...form, duracao_min: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1h</SelectItem>
                  <SelectItem value="90">1h30</SelectItem>
                  <SelectItem value="120">2h</SelectItem>
                  <SelectItem value="180">3h</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Local</Label>
              <Input placeholder="Escritório do cliente / Google Meet" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
            </div>
            <div>
              <Label>Link da reunião</Label>
              <Input placeholder="https://meet.google.com/..." value={form.link_reuniao} onChange={(e) => setForm({ ...form, link_reuniao: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!form.client_name || !form.closer_nome || create.isPending}
          >
            {create.isPending ? 'Agendando...' : 'Agendar reunião'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

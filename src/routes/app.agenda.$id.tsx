import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, Clock, MapPin, Link as LinkIcon, User, Phone, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchAgendaById, atualizarAgendamento, confirmarPresenca,
  registrarResultado, cancelarAgendamento,
  STATUS_REUNIAO, CORES_TIPO,
} from '@/modules/crm/services-agenda';

export const Route = createFileRoute('/app/agenda/$id')({
  component: AgendaDetailPage,
});

function AgendaDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: item, isLoading } = useQuery({
    queryKey: ['agenda', id],
    queryFn: () => fetchAgendaById(id),
  });

  const [resultado, setResultado] = useState('');
  const [proximaAcao, setProximaAcao] = useState('');
  const [dataProximaAcao, setDataProximaAcao] = useState('');
  const [statusFinal, setStatusFinal] = useState('Realizado');
  const [showResultado, setShowResultado] = useState(false);

  useEffect(() => {
    if (item) {
      setResultado(item.resultado ?? '');
      setProximaAcao(item.proxima_acao ?? '');
      setDataProximaAcao(item.data_proxima_acao ?? '');
      setStatusFinal(item.status === 'Agendado' || item.status === 'Confirmado' ? 'Realizado' : item.status);
    }
  }, [item]);

  const confirm = useMutation({
    mutationFn: () => confirmarPresenca(id),
    onSuccess: () => {
      toast.success('Presença confirmada');
      qc.invalidateQueries({ queryKey: ['agenda', id] });
      qc.invalidateQueries({ queryKey: ['agenda'] });
    },
  });

  const cancel = useMutation({
    mutationFn: () => cancelarAgendamento(id),
    onSuccess: () => {
      toast.success('Reunião cancelada');
      qc.invalidateQueries({ queryKey: ['agenda', id] });
      qc.invalidateQueries({ queryKey: ['agenda'] });
    },
  });

  const naoCompareceu = useMutation({
    mutationFn: () => atualizarAgendamento(id, { status: 'Cliente não compareceu' }),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['agenda', id] });
    },
  });

  const saveResultado = useMutation({
    mutationFn: () => registrarResultado(id, resultado, proximaAcao, dataProximaAcao, statusFinal),
    onSuccess: () => {
      toast.success('Resultado salvo');
      setShowResultado(false);
      qc.invalidateQueries({ queryKey: ['agenda', id] });
      qc.invalidateQueries({ queryKey: ['agenda'] });
    },
  });

  if (isLoading) return <div className="p-6">Carregando...</div>;
  if (!item) return <div className="p-6">Reunião não encontrada.</div>;

  const inicio = new Date(item.data_inicio);
  const fim = new Date(item.data_fim);
  const horasAteReuniao = (inicio.getTime() - Date.now()) / (1000 * 60 * 60);
  const semConfirmacaoUrgente = !item.closer_confirmou && horasAteReuniao > 0 && horasAteReuniao < 24;
  const jaPassou = inicio.getTime() < Date.now();
  const podeRegistrarResultado = jaPassou || ['Realizado', 'Cancelado', 'Cliente não compareceu'].includes(item.status);

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/app/agenda' })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge className={CORES_TIPO[item.tipo] ?? ''}>{item.tipo}</Badge>
          <Badge variant={item.status === 'Confirmado' || item.status === 'Realizado' ? 'default' : 'outline'}>
            {item.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {!item.closer_confirmou && item.status === 'Agendado' && (
            <Button size="sm" onClick={() => confirm.mutate()}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar presença
            </Button>
          )}
          {item.status !== 'Cancelado' && (
            <Button size="sm" variant="destructive" onClick={() => cancel.mutate()}>Cancelar</Button>
          )}
        </div>
      </div>

      {semConfirmacaoUrgente && (
        <Card className="border-red-500 bg-red-500/10">
          <CardContent className="p-3 flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Reunião em menos de 24h sem confirmação do closer.</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{item.client_name}</CardTitle>
          {item.proposal_number && (
            <p className="text-sm text-muted-foreground">Proposta: {item.proposal_number}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row icon={<Calendar className="h-4 w-4" />} label="Data">
            {inicio.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </Row>
          <Row icon={<Clock className="h-4 w-4" />} label="Horário">
            {inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} – {fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ({item.duracao_min} min)
          </Row>
          {item.local && <Row icon={<MapPin className="h-4 w-4" />} label="Local">{item.local}</Row>}
          {item.link_reuniao && (
            <Row icon={<LinkIcon className="h-4 w-4" />} label="Link">
              <a href={item.link_reuniao} target="_blank" rel="noreferrer" className="text-primary underline">
                {item.link_reuniao}
              </a>
            </Row>
          )}
          <Row icon={<User className="h-4 w-4" />} label="Closer">{item.closer_nome}</Row>
          {item.sdr_nome && <Row icon={<User className="h-4 w-4" />} label="SDR">{item.sdr_nome}</Row>}
          {item.contato_cliente && <Row icon={<User className="h-4 w-4" />} label="Contato">{item.contato_cliente}</Row>}
          {item.telefone_cliente && (
            <Row icon={<Phone className="h-4 w-4" />} label="Telefone">
              <a href={`tel:${item.telefone_cliente}`} className="text-primary underline">{item.telefone_cliente}</a>
            </Row>
          )}
          {item.email_cliente && (
            <Row icon={<Mail className="h-4 w-4" />} label="Email">
              <a href={`mailto:${item.email_cliente}`} className="text-primary underline">{item.email_cliente}</a>
            </Row>
          )}
          {item.observacoes && (
            <div className="pt-2">
              <p className="font-semibold mb-1">Observações</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{item.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Participação do Closer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <Switch
              checked={item.closer_confirmou}
              onCheckedChange={(v) => v && confirm.mutate()}
              disabled={item.closer_confirmou}
            />
            <span className="text-sm">
              {item.closer_confirmou
                ? `Confirmado ${item.closer_confirmou_at ? `em ${new Date(item.closer_confirmou_at).toLocaleString('pt-BR')}` : ''}`
                : 'Aguardando confirmação'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultado da Reunião</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(item.resultado || showResultado || podeRegistrarResultado) ? (
            <>
              <div>
                <Label>Resultado</Label>
                <Textarea rows={3} value={resultado} onChange={(e) => setResultado(e.target.value)} placeholder="O que foi discutido, decisões tomadas..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Próxima ação</Label>
                  <Input value={proximaAcao} onChange={(e) => setProximaAcao(e.target.value)} placeholder="Ex: Enviar proposta final" />
                </div>
                <div>
                  <Label>Data da próxima ação</Label>
                  <Input type="date" value={dataProximaAcao} onChange={(e) => setDataProximaAcao(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Status final</Label>
                <Select value={statusFinal} onValueChange={setStatusFinal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_REUNIAO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => saveResultado.mutate()} disabled={saveResultado.isPending}>
                {saveResultado.isPending ? 'Salvando...' : 'Salvar resultado'}
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowResultado(true)}>Registrar resultado</Button>
              <Button variant="outline" onClick={() => naoCompareceu.mutate()}>Cliente não compareceu</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <span className="font-semibold w-24 shrink-0">{label}:</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}

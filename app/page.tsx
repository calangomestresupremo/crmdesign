'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type StageId = 'new' | 'first-contact' | 'briefing' | 'proposal' | 'negotiation' | 'won' | 'lost';
type View = 'pipeline' | 'leads' | 'import';
type ActivityType = 'Ligação' | 'WhatsApp' | 'E-mail' | 'Reunião' | 'Proposta' | 'Follow-up' | 'Nota';

type Stage = {
  id: StageId;
  title: string;
  description: string;
  accent: string;
};

type Activity = {
  id: string;
  type: ActivityType;
  description: string;
  date: string;
  nextFollowUp?: string;
};

type Lead = {
  id: string;
  nome: string;
  empresa: string;
  email: string;
  telefone: string;
  instagram: string;
  site: string;
  origem: string;
  servicoInteresse: string;
  orcamentoEstimado: number;
  observacoes: string;
  pipelineStageId: StageId;
  activities: Activity[];
  createdAt: string;
  updatedAt: string;
};

type LeadDraft = Omit<Lead, 'id' | 'activities' | 'createdAt' | 'updatedAt'>;
type ModalState = { type: 'new' } | { type: 'profile'; leadId: string } | { type: 'edit'; leadId: string } | null;
type ImportRow = Record<string, string>;
type LeadImportField = keyof Pick<Lead, 'nome' | 'empresa' | 'email' | 'telefone' | 'instagram' | 'site' | 'origem' | 'servicoInteresse' | 'orcamentoEstimado' | 'observacoes'>;

const storageKey = 'crm-design-leads-next-v1';
const stages: Stage[] = [
  { id: 'new', title: 'Novo lead', description: 'Oportunidades recém-captadas para qualificar.', accent: '#ffaa00' },
  { id: 'first-contact', title: 'Primeiro contato', description: 'Mensagem, ligação ou e-mail inicial enviado.', accent: '#ff9a00' },
  { id: 'briefing', title: 'Briefing marcado', description: 'Reunião ou formulário de briefing agendado.', accent: '#ff8500' },
  { id: 'proposal', title: 'Proposta enviada', description: 'Escopo, prazo e investimento enviados ao cliente.', accent: '#ff7300' },
  { id: 'negotiation', title: 'Negociação', description: 'Ajustes, objeções e fechamento.', accent: '#ff5f00' },
  { id: 'won', title: 'Fechado', description: 'Venda concluída e projeto pronto para onboarding.', accent: '#10b981' },
  { id: 'lost', title: 'Perdido', description: 'Oportunidade perdida ou sem fit no momento.', accent: '#ef4444' },
];
const importFields: { key: LeadImportField; label: string; required?: boolean }[] = [
  { key: 'nome', label: 'Nome', required: true },
  { key: 'empresa', label: 'Empresa' },
  { key: 'email', label: 'E-mail' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'site', label: 'Site' },
  { key: 'origem', label: 'Origem' },
  { key: 'servicoInteresse', label: 'Serviço de interesse' },
  { key: 'orcamentoEstimado', label: 'Orçamento estimado' },
  { key: 'observacoes', label: 'Observações' },
];
const activityTypes: ActivityType[] = ['Ligação', 'WhatsApp', 'E-mail', 'Reunião', 'Proposta', 'Follow-up', 'Nota'];

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [view, setView] = useState<View>('pipeline');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importMessage, setImportMessage] = useState('');
  const [importMapping, setImportMapping] = useState<Record<LeadImportField, string>>(emptyMapping());

  useEffect(() => {
    const stored = loadLeads();
    setLeads(stored.length ? stored : seedLeads());
  }, []);

  useEffect(() => {
    if (leads.length) localStorage.setItem(storageKey, JSON.stringify(leads));
  }, [leads]);

  const headers = Object.keys(importRows[0] ?? {});
  const selectedLead = modal?.type === 'profile' || modal?.type === 'edit' ? leads.find((lead) => lead.id === modal.leadId) : undefined;
  const filteredLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return leads;
    return leads.filter((lead) => [lead.nome, lead.empresa, lead.email, lead.telefone, lead.origem, lead.servicoInteresse].join(' ').toLowerCase().includes(normalized));
  }, [leads, query]);
  const metrics = useMemo(() => {
    const open = leads.filter((lead) => lead.pipelineStageId !== 'won' && lead.pipelineStageId !== 'lost');
    const won = leads.filter((lead) => lead.pipelineStageId === 'won');
    return {
      open: open.length,
      won: won.length,
      pipelineValue: open.reduce((sum, lead) => sum + lead.orcamentoEstimado, 0),
      wonValue: won.reduce((sum, lead) => sum + lead.orcamentoEstimado, 0),
    };
  }, [leads]);

  function saveLead(draft: LeadDraft, leadId?: string) {
    const timestamp = new Date().toISOString();
    setLeads((current) => leadId
      ? current.map((lead) => lead.id === leadId ? { ...lead, ...draft, updatedAt: timestamp } : lead)
      : [{ ...draft, id: createId('lead'), activities: [], createdAt: timestamp, updatedAt: timestamp }, ...current]);
    setModal(null);
  }

  function updateStage(leadId: string, stageId: StageId) {
    setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, pipelineStageId: stageId, updatedAt: new Date().toISOString() } : lead));
  }

  function addActivity(leadId: string, activity: Omit<Activity, 'id'>) {
    setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, activities: [{ ...activity, id: createId('activity') }, ...lead.activities], updatedAt: new Date().toISOString() } : lead));
  }

  function exportLeads() {
    const blob = new Blob([JSON.stringify(leads, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'crm-design-leads.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function parseLeadFile(file?: File) {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const text = await file.text();
    try {
      let rows: ImportRow[];
      if (extension === 'xls' && text.trim().startsWith('<')) {
        rows = parseHtmlTable(text);
      } else if (extension === 'xls' || extension === 'xlsx') {
        throw new Error('para importar planilhas binárias XLS/XLSX, salve a planilha como CSV e envie novamente. Arquivos .xls baseados em HTML são aceitos.');
      } else if (extension === 'json') {
        const parsed = JSON.parse(text) as Record<string, unknown>[];
        rows = Array.isArray(parsed) ? parsed.map(stringifyRow) : [];
      } else {
        rows = parseDelimited(text, extension === 'tsv' ? '\t' : detectDelimiter(text));
      }
      setImportRows(rows);
      setImportMapping(autoMap(Object.keys(rows[0] ?? {})));
      setImportMessage(`Arquivo ${file.name} carregado para prévia.`);
    } catch (error) {
      setImportMessage(`Erro: ${(error as Error).message}`);
    }
  }

  function confirmImport() {
    const timestamp = new Date().toISOString();
    const imported = importRows.filter((row) => (row[importMapping.nome] ?? '').trim()).map((row) => rowToDraft(row, importMapping));
    setLeads((current) => [...imported.map((draft) => ({ ...draft, id: createId('lead'), activities: [], createdAt: timestamp, updatedAt: timestamp })), ...current]);
    setImportRows([]);
    setImportMapping(emptyMapping());
    setImportMessage(`${imported.length} leads importados com sucesso.`);
    setView('pipeline');
  }

  const validImportRows = importRows.filter((row) => (row[importMapping.nome] ?? '').trim()).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">CD</div><div><strong>CRM Design</strong><span>Vendas para designers</span></div></div>
        <nav>
          <button className={view === 'pipeline' ? 'active' : ''} onClick={() => setView('pipeline')}>▦ Pipeline</button>
          <button className={view === 'leads' ? 'active' : ''} onClick={() => setView('leads')}>◉ Leads</button>
          <button className={view === 'import' ? 'active' : ''} onClick={() => setView('import')}>⇪ Importar</button>
        </nav>
        <div className="sidebar-note"><strong>✦ Prospecção com foco</strong><p>Controle briefing, proposta, negociação e fechamento em um fluxo simples.</p></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">Pipeline comercial</p><h1>Venda design com previsibilidade</h1><p>Organize leads, registre contatos e acompanhe o valor de oportunidades por etapa.</p></div>
          <div className="topbar-actions"><button className="button button-secondary" onClick={exportLeads}>Exportar JSON</button><button className="button button-primary" onClick={() => setModal({ type: 'new' })}>+ Novo lead</button></div>
        </header>

        <section className="metric-grid">
          <Metric label="Leads em aberto" value={String(metrics.open)} />
          <Metric label="Valor no pipeline" value={money(metrics.pipelineValue)} />
          <Metric label="Clientes fechados" value={String(metrics.won)} />
          <Metric label="Receita fechada" value={money(metrics.wonValue)} />
        </section>

        <section className="toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque por nome, empresa, origem ou serviço" /><span>⌕</span></section>

        {view === 'pipeline' && <Pipeline leads={filteredLeads} onOpen={(leadId) => setModal({ type: 'profile', leadId })} onMove={updateStage} />}
        {view === 'leads' && <LeadTable leads={filteredLeads} onOpen={(leadId) => setModal({ type: 'profile', leadId })} />}
        {view === 'import' && (
          <section className="card import-card">
            <div className="section-heading"><div><p className="eyebrow">Importação</p><h2>Importar leads</h2><p>Suba CSV, TSV, TXT, JSON ou `.xls` baseado em tabela HTML. Para XLS/XLSX binário, salve como CSV antes.</p></div><span className="big-icon">⇪</span></div>
            <label className="dropzone"><strong>Escolha um arquivo de leads</strong><span>Formatos: .csv, .tsv, .txt, .json, .xls e .xlsx convertido para CSV</span><input type="file" accept=".csv,.tsv,.txt,.json,.xls,.xlsx" onChange={(event) => void parseLeadFile(event.target.files?.[0])} /></label>
            {importMessage && <div className={`import-alert ${importMessage.startsWith('Erro') ? 'error' : 'success'}`}>{importMessage}</div>}
            {importRows.length > 0 && (
              <>
                <div className="import-alert success">{importRows.length} linhas encontradas · {validImportRows} válidas com nome preenchido</div>
                <div className="mapping-grid">
                  {importFields.map((field) => <label className="field" key={field.key}><span>{field.label}{field.required ? ' *' : ''}</span><select value={importMapping[field.key]} onChange={(event) => setImportMapping((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">Não importar</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}
                </div>
                <TablePreview rows={importRows} headers={headers} />
                <div className="form-actions"><button className="button button-secondary" onClick={() => setImportRows([])}>Limpar prévia</button><button className="button button-primary" disabled={!importMapping.nome || validImportRows === 0} onClick={confirmImport}>Importar {validImportRows} leads</button></div>
              </>
            )}
          </section>
        )}
      </main>

      {modal?.type === 'new' && <Modal title="Adicionar lead" description="Cadastre uma nova oportunidade no CRM Design." onClose={() => setModal(null)}><LeadForm onSubmit={(draft) => saveLead(draft)} onCancel={() => setModal(null)} /></Modal>}
      {modal?.type === 'profile' && selectedLead && <Modal title="Perfil do lead" onClose={() => setModal(null)}><LeadProfile lead={selectedLead} onEdit={() => setModal({ type: 'edit', leadId: selectedLead.id })} onUpdateStage={updateStage} onAddActivity={addActivity} /></Modal>}
      {modal?.type === 'edit' && selectedLead && <Modal title="Editar lead" description="Atualize dados, etapa e contexto da oportunidade." onClose={() => setModal(null)}><LeadForm lead={selectedLead} onSubmit={(draft) => saveLead(draft, selectedLead.id)} onCancel={() => setModal(null)} /></Modal>}
    </div>
  );
}

function Pipeline({ leads, onOpen, onMove }: { leads: Lead[]; onOpen: (leadId: string) => void; onMove: (leadId: string, stageId: StageId) => void }) {
  return <section className="pipeline-board" aria-label="Pipeline de vendas">{stages.map((stage) => {
    const stageLeads = leads.filter((lead) => lead.pipelineStageId === stage.id);
    const total = stageLeads.reduce((sum, lead) => sum + lead.orcamentoEstimado, 0);
    return <div className="pipeline-column" key={stage.id} style={{ '--stage-color': stage.accent } as CSSProperties}><header className="column-header"><div><h3>{stage.title}</h3><p>{stageLeads.length} lead{stageLeads.length === 1 ? '' : 's'}</p></div><span>{money(total)}</span></header><div className="lead-card-list">{stageLeads.length ? stageLeads.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={onOpen} onMove={onMove} />) : <p className="empty-column">Altere a etapa no perfil para mover oportunidades para cá.</p>}</div></div>;
  })}</section>;
}

function LeadCard({ lead, onOpen, onMove }: { lead: Lead; onOpen: (leadId: string) => void; onMove: (leadId: string, stageId: StageId) => void }) {
  const currentIndex = stages.findIndex((stage) => stage.id === lead.pipelineStageId);
  const nextStage = stages[currentIndex + 1];
  const lastActivity = [...lead.activities].sort((a, b) => b.date.localeCompare(a.date))[0];
  return <article className="card lead-card"><button className="lead-card-open" onClick={() => onOpen(lead.id)}><strong>{lead.nome}</strong><span>{lead.empresa || lead.origem || 'Lead sem empresa'}</span></button><p>{lead.servicoInteresse || 'Serviço ainda não informado'}</p><div className="lead-card-meta"><span>💰 {money(lead.orcamentoEstimado)}</span><span>{lastActivity ? `Último: ${lastActivity.type}` : 'Sem contato'}</span></div>{nextStage && <button className="move-button" onClick={() => onMove(lead.id, nextStage.id)}>Mover para {nextStage.title} →</button>}</article>;
}

function LeadTable({ leads, onOpen }: { leads: Lead[]; onOpen: (leadId: string) => void }) {
  return <section className="card leads-table-card"><div className="section-heading"><div><p className="eyebrow">Controle de leads</p><h2>Todos os leads</h2></div><span>{leads.length} registros</span></div><div className="table-wrap"><table><thead><tr><th>Nome</th><th>Empresa</th><th>Etapa</th><th>Serviço</th><th>Valor</th><th>Contato</th></tr></thead><tbody>{leads.map((lead) => <tr className="clickable-row" key={lead.id} onClick={() => onOpen(lead.id)}><td>{lead.nome}</td><td>{lead.empresa || '-'}</td><td>{stageTitle(lead.pipelineStageId)}</td><td>{lead.servicoInteresse || '-'}</td><td>{money(lead.orcamentoEstimado)}</td><td>{lead.email || lead.telefone || '-'}</td></tr>)}</tbody></table></div></section>;
}

function LeadForm({ lead, onSubmit, onCancel }: { lead?: Lead; onSubmit: (draft: LeadDraft) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<LeadDraft>(lead ?? blankDraft());
  const setValue = <K extends keyof LeadDraft>(field: K, value: LeadDraft[K]) => setDraft((current) => ({ ...current, [field]: value }));
  return <form className="lead-form" onSubmit={(event) => { event.preventDefault(); onSubmit(draft); }}><div className="form-grid two-columns"><Field label="Nome"><input required value={draft.nome} onChange={(event) => setValue('nome', event.target.value)} /></Field><Field label="Empresa"><input value={draft.empresa} onChange={(event) => setValue('empresa', event.target.value)} /></Field><Field label="E-mail"><input type="email" value={draft.email} onChange={(event) => setValue('email', event.target.value)} /></Field><Field label="Telefone / WhatsApp"><input value={draft.telefone} onChange={(event) => setValue('telefone', event.target.value)} /></Field><Field label="Instagram"><input value={draft.instagram} onChange={(event) => setValue('instagram', event.target.value)} /></Field><Field label="Site"><input value={draft.site} onChange={(event) => setValue('site', event.target.value)} /></Field><Field label="Origem"><input value={draft.origem} onChange={(event) => setValue('origem', event.target.value)} /></Field><Field label="Serviço de interesse"><input value={draft.servicoInteresse} onChange={(event) => setValue('servicoInteresse', event.target.value)} /></Field><Field label="Orçamento estimado"><input type="number" min="0" value={draft.orcamentoEstimado} onChange={(event) => setValue('orcamentoEstimado', Number(event.target.value))} /></Field><Field label="Etapa"><select value={draft.pipelineStageId} onChange={(event) => setValue('pipelineStageId', event.target.value as StageId)}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.title}</option>)}</select></Field></div><Field label="Observações"><textarea rows={4} value={draft.observacoes} onChange={(event) => setValue('observacoes', event.target.value)} /></Field><div className="form-actions"><button className="button button-secondary" type="button" onClick={onCancel}>Cancelar</button><button className="button button-primary" type="submit">{lead ? 'Salvar alterações' : 'Adicionar lead'}</button></div></form>;
}

function LeadProfile({ lead, onEdit, onUpdateStage, onAddActivity }: { lead: Lead; onEdit: () => void; onUpdateStage: (leadId: string, stageId: StageId) => void; onAddActivity: (leadId: string, activity: Omit<Activity, 'id'>) => void }) {
  const [type, setType] = useState<ActivityType>('Follow-up');
  const [description, setDescription] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  return <div className="profile-grid"><section className="card profile-main"><div className="profile-hero"><div><p className="eyebrow">Perfil do lead</p><h2>{lead.nome}</h2><p>{lead.empresa || 'Empresa não informada'} · {lead.servicoInteresse || 'Serviço a definir'}</p></div><button className="button button-primary" onClick={onEdit}>Editar dados</button></div><div className="profile-details"><span>✉ {lead.email || 'Sem e-mail'}</span><span>☎ {lead.telefone || 'Sem telefone'}</span><span>↗ {lead.instagram || lead.site || 'Sem redes cadastradas'}</span><span>🏆 {money(lead.orcamentoEstimado)}</span></div><Field label="Etapa da conversão"><select value={lead.pipelineStageId} onChange={(event) => onUpdateStage(lead.id, event.target.value as StageId)}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.title}</option>)}</select></Field><div className="notes-box"><h3>Observações</h3><p>{lead.observacoes || 'Nenhuma observação registrada.'}</p></div></section><section className="card activity-panel"><div className="section-heading"><div><p className="eyebrow">Contato</p><h3>Atividades e follow-ups</h3></div><span>◷</span></div><form className="activity-form" onSubmit={(event) => { event.preventDefault(); if (!description.trim()) return; onAddActivity(lead.id, { type, description, date: new Date().toISOString(), nextFollowUp: nextFollowUp || undefined }); setDescription(''); setNextFollowUp(''); }}><Field label="Tipo"><select value={type} onChange={(event) => setType(event.target.value as ActivityType)}>{activityTypes.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Resumo do contato"><textarea rows={3} required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: pediu proposta com 2 opções de investimento." /></Field><Field label="Próximo follow-up"><input type="date" value={nextFollowUp} onChange={(event) => setNextFollowUp(event.target.value)} /></Field><button className="button button-primary" type="submit">+ Registrar atividade</button></form><div className="timeline">{lead.activities.length ? [...lead.activities].sort((a, b) => b.date.localeCompare(a.date)).map((activity) => <article className="timeline-item" key={activity.id}><strong>{activity.type}</strong><time>{dateBr(activity.date)}</time><p>{activity.description}</p>{activity.nextFollowUp && <small>Follow-up: {dateBr(activity.nextFollowUp)}</small>}</article>) : <p className="empty-state">Nenhuma atividade registrada ainda.</p>}</div></section></div>;
}

function Modal({ title, description, children, onClose }: { title: string; description?: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header className="modal-header"><div><p className="eyebrow">CRM Design</p><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="button button-ghost" onClick={onClose}>×</button></header>{children}</section></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="card metric-card"><span>{label}</span><strong>{value}</strong></article>;
}

function TablePreview({ rows, headers }: { rows: ImportRow[]; headers: string[] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.slice(0, 5).map((row, index) => <tr key={index}>{headers.map((header) => <td key={header}>{row[header]}</td>)}</tr>)}</tbody></table></div>;
}

function loadLeads(): Lead[] {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as Lead[]; } catch { return []; }
}

function seedLeads(): Lead[] {
  const now = new Date().toISOString();
  return [
    { ...blankDraft(), id: 'lead-aurora', nome: 'Marina Torres', empresa: 'Aurora Café', email: 'marina@auroracafe.com', telefone: '(11) 98888-0190', instagram: '@auroracafe', site: 'https://auroracafe.com', origem: 'Instagram', servicoInteresse: 'Identidade visual', orcamentoEstimado: 6500, observacoes: 'Quer reposicionar a marca para abrir uma segunda unidade.', pipelineStageId: 'briefing', activities: [{ id: 'activity-1', type: 'WhatsApp', description: 'Enviou referências visuais e pediu agenda para briefing.', date: now, nextFollowUp: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) }], createdAt: now, updatedAt: now },
    { ...blankDraft(), id: 'lead-nova', nome: 'Rafael Lima', empresa: 'NovaFit Studio', email: 'rafael@novafit.com', telefone: '(21) 97777-2201', instagram: '@novafitstudio', site: 'https://novafit.example', origem: 'Indicação', servicoInteresse: 'Landing page de vendas', orcamentoEstimado: 4200, observacoes: 'Precisa lançar campanha em até 30 dias.', pipelineStageId: 'proposal', activities: [{ id: 'activity-2', type: 'Proposta', description: 'Proposta enviada com duas opções de escopo.', date: now, nextFollowUp: new Date(Date.now() + 172_800_000).toISOString().slice(0, 10) }], createdAt: now, updatedAt: now },
    { ...blankDraft(), id: 'lead-bossa', nome: 'Camila Rocha', empresa: 'Bossa Decor', email: 'camila@bossadecor.com', telefone: '(31) 96666-3302', instagram: '@bossadecor', origem: 'Formulário do site', servicoInteresse: 'Social media kit', orcamentoEstimado: 2800, observacoes: 'Comparando fornecedores para pacote mensal.', pipelineStageId: 'first-contact', activities: [], createdAt: now, updatedAt: now },
  ];
}

function blankDraft(): LeadDraft {
  return { nome: '', empresa: '', email: '', telefone: '', instagram: '', site: '', origem: '', servicoInteresse: '', orcamentoEstimado: 0, observacoes: '', pipelineStageId: 'new' };
}

function emptyMapping(): Record<LeadImportField, string> {
  return { nome: '', empresa: '', email: '', telefone: '', instagram: '', site: '', origem: '', servicoInteresse: '', orcamentoEstimado: '', observacoes: '' };
}

function parseHtmlTable(text: string): ImportRow[] {
  const documentTable = new DOMParser().parseFromString(text, 'text/html');
  const rows = Array.from(documentTable.querySelectorAll('tr')).map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent?.trim() ?? ''));
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function parseDelimited(text: string, delimiter: string): ImportRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0], delimiter).map((header) => header.trim());
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, splitCsvLine(line, delimiter)[index] ?? ''])));
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && insideQuotes && next === '"') { current += '"'; index += 1; continue; }
    if (char === '"') { insideQuotes = !insideQuotes; continue; }
    if (char === delimiter && !insideQuotes) { result.push(current); current = ''; continue; }
    current += char;
  }
  result.push(current);
  return result.map((value) => value.trim());
}

function detectDelimiter(text: string) {
  return (text.split(/\r?\n/)[0] ?? '').includes(';') ? ';' : ',';
}

function rowToDraft(row: ImportRow, mapping: Record<LeadImportField, string>): LeadDraft {
  const read = (field: LeadImportField) => row[mapping[field]]?.trim() ?? '';
  return { nome: read('nome'), empresa: read('empresa'), email: read('email'), telefone: read('telefone'), instagram: read('instagram'), site: read('site'), origem: read('origem'), servicoInteresse: read('servicoInteresse'), orcamentoEstimado: Number(read('orcamentoEstimado').replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0, observacoes: read('observacoes'), pipelineStageId: 'new' };
}

function autoMap(headers: string[]): Record<LeadImportField, string> {
  const find = (...needles: string[]) => headers.find((header) => needles.some((needle) => normalize(header).includes(needle))) ?? '';
  return { nome: find('nome', 'name', 'contato'), empresa: find('empresa', 'company', 'marca', 'negocio'), email: find('email', 'mail'), telefone: find('telefone', 'phone', 'whatsapp', 'celular'), instagram: find('instagram', 'insta'), site: find('site', 'website', 'url'), origem: find('origem', 'source', 'canal'), servicoInteresse: find('servico', 'interesse', 'projeto'), orcamentoEstimado: find('orcamento', 'budget', 'valor'), observacoes: find('observacao', 'observacoes', 'nota') };
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function stringifyRow(row: Record<string, unknown>): ImportRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? '')]));
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function stageTitle(stageId: StageId) {
  return stages.find((stage) => stage.id === stageId)?.title ?? stageId;
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0);
}

function dateBr(value: string) {
  return new Date(value).toLocaleDateString('pt-BR');
}

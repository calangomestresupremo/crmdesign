type StageId = 'new' | 'first-contact' | 'briefing' | 'proposal' | 'negotiation' | 'won' | 'lost';
type View = 'pipeline' | 'leads' | 'import';
type ActivityType = 'Ligação' | 'WhatsApp' | 'E-mail' | 'Reunião' | 'Proposta' | 'Follow-up' | 'Nota';

interface Stage {
  id: StageId;
  title: string;
  description: string;
  accent: string;
}

interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  date: string;
  nextFollowUp?: string;
}

interface Lead {
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
}

type LeadDraft = Omit<Lead, 'id' | 'activities' | 'createdAt' | 'updatedAt'>;
type ImportRow = Record<string, string>;
type LeadImportField = keyof Pick<Lead, 'nome' | 'empresa' | 'email' | 'telefone' | 'instagram' | 'site' | 'origem' | 'servicoInteresse' | 'orcamentoEstimado' | 'observacoes'>;

const storageKey = 'crm-design-leads-v2';
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

const now = new Date().toISOString();
let leads: Lead[] = loadLeads();
let view: View = 'pipeline';
let search = '';
let modal: 'new' | 'profile' | 'edit' | null = null;
let selectedLeadId = '';
let importRows: ImportRow[] = [];
let importHeaders: string[] = [];
let importMapping: Record<LeadImportField, string> = emptyMapping();
let importMessage = '';

if (leads.length === 0) {
  leads = seedLeads();
  saveLeads();
}

render();

function render() {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;
  const filtered = filteredLeads();
  const metrics = buildMetrics();

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">CD</div><div><strong>CRM Design</strong><span>Vendas para designers</span></div></div>
        <nav>
          ${navButton('pipeline', '▦', 'Pipeline')}
          ${navButton('leads', '◉', 'Leads')}
          ${navButton('import', '⇪', 'Importar')}
        </nav>
        <div class="sidebar-note"><strong>✦ Prospecção com foco</strong><p>Controle briefing, proposta, negociação e fechamento em um fluxo simples.</p></div>
      </aside>
      <main class="workspace">
        <header class="topbar">
          <div><p class="eyebrow">Pipeline comercial</p><h1>Venda design com previsibilidade</h1><p>Organize leads, registre contatos e acompanhe o valor de oportunidades por etapa.</p></div>
          <div class="topbar-actions"><button class="button button-secondary" data-action="export">Exportar JSON</button><button class="button button-primary" data-action="new-lead">+ Novo lead</button></div>
        </header>
        <section class="metric-grid">
          ${metricCard('Leads em aberto', String(metrics.open))}
          ${metricCard('Valor no pipeline', money(metrics.pipelineValue))}
          ${metricCard('Clientes fechados', String(metrics.won))}
          ${metricCard('Receita fechada', money(metrics.wonValue))}
        </section>
        <section class="toolbar"><input id="search" value="${escapeAttr(search)}" placeholder="Busque por nome, empresa, origem ou serviço" /><span>⌕</span></section>
        ${view === 'pipeline' ? renderPipeline(filtered) : ''}
        ${view === 'leads' ? renderLeadTable(filtered) : ''}
        ${view === 'import' ? renderImport() : ''}
      </main>
    </div>
    ${renderModal()}`;
  bindEvents();
}

function navButton(target: View, icon: string, label: string) {
  return `<button class="${view === target ? 'active' : ''}" data-view="${target}"><span>${icon}</span>${label}</button>`;
}

function metricCard(label: string, value: string) {
  return `<article class="card metric-card"><span>${label}</span><strong>${value}</strong></article>`;
}

function renderPipeline(filtered: Lead[]) {
  return `<section class="pipeline-board" aria-label="Pipeline de vendas">
    ${stages.map((stage) => {
      const stageLeads = filtered.filter((lead) => lead.pipelineStageId === stage.id);
      const total = stageLeads.reduce((sum, lead) => sum + lead.orcamentoEstimado, 0);
      return `<div class="pipeline-column" style="--stage-color:${stage.accent}">
        <header class="column-header"><div><h3>${stage.title}</h3><p>${stageLeads.length} lead${stageLeads.length === 1 ? '' : 's'}</p></div><span>${money(total)}</span></header>
        <div class="lead-card-list">${stageLeads.length ? stageLeads.map(renderLeadCard).join('') : '<p class="empty-column">Altere a etapa no perfil para mover oportunidades para cá.</p>'}</div>
      </div>`;
    }).join('')}
  </section>`;
}

function renderLeadCard(lead: Lead) {
  const currentIndex = stages.findIndex((stage) => stage.id === lead.pipelineStageId);
  const nextStage = stages[currentIndex + 1];
  const lastActivity = [...lead.activities].sort((a, b) => b.date.localeCompare(a.date))[0];
  return `<article class="card lead-card">
    <button class="lead-card-open" data-open="${lead.id}"><strong>${escapeHtml(lead.nome)}</strong><span>${escapeHtml(lead.empresa || lead.origem || 'Lead sem empresa')}</span></button>
    <p>${escapeHtml(lead.servicoInteresse || 'Serviço ainda não informado')}</p>
    <div class="lead-card-meta"><span>💰 ${money(lead.orcamentoEstimado)}</span><span>${lastActivity ? `Último: ${escapeHtml(lastActivity.type)}` : 'Sem contato'}</span></div>
    ${nextStage ? `<button class="move-button" data-move="${lead.id}" data-stage="${nextStage.id}">Mover para ${nextStage.title} →</button>` : ''}
  </article>`;
}

function renderLeadTable(filtered: Lead[]) {
  return `<section class="card leads-table-card"><div class="section-heading"><div><p class="eyebrow">Controle de leads</p><h2>Todos os leads</h2></div><span>${filtered.length} registros</span></div><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Empresa</th><th>Etapa</th><th>Serviço</th><th>Valor</th><th>Contato</th></tr></thead><tbody>${filtered.map((lead) => `<tr class="clickable-row" data-open="${lead.id}"><td>${escapeHtml(lead.nome)}</td><td>${escapeHtml(lead.empresa || '-')}</td><td>${stageTitle(lead.pipelineStageId)}</td><td>${escapeHtml(lead.servicoInteresse || '-')}</td><td>${money(lead.orcamentoEstimado)}</td><td>${escapeHtml(lead.email || lead.telefone || '-')}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function renderImport() {
  const validRows = importRows.filter((row) => (row[importMapping.nome] ?? '').trim().length > 0);
  return `<section class="card import-card"><div class="section-heading"><div><p class="eyebrow">Importação</p><h2>Importar leads</h2><p>Suba CSV, TSV, TXT, JSON ou cole dados exportados de planilhas. Arquivos XLS/XLSX podem ser salvos como CSV antes da importação.</p></div><span class="big-icon">⇪</span></div>
    <label class="dropzone"><strong>Escolha um arquivo de leads</strong><span>Formatos aceitos diretamente: .csv, .tsv, .txt e .json</span><input id="lead-file" type="file" accept=".csv,.tsv,.txt,.json,.xls,.xlsx" /></label>
    ${importMessage ? `<div class="import-alert ${importMessage.startsWith('Erro') ? 'error' : 'success'}">${escapeHtml(importMessage)}</div>` : ''}
    ${importRows.length ? `<div class="import-alert success">${importRows.length} linhas encontradas · ${validRows.length} válidas com nome preenchido</div><div class="mapping-grid">${importFields.map((field) => `<label class="field"><span>${field.label}${field.required ? ' *' : ''}</span><select data-map="${field.key}"><option value="">Não importar</option>${importHeaders.map((header) => `<option value="${escapeAttr(header)}" ${importMapping[field.key] === header ? 'selected' : ''}>${escapeHtml(header)}</option>`).join('')}</select></label>`).join('')}</div>${renderImportPreview()}<div class="form-actions"><button class="button button-secondary" data-action="clear-import">Limpar prévia</button><button class="button button-primary" data-action="confirm-import" ${!importMapping.nome || validRows.length === 0 ? 'disabled' : ''}>Importar ${validRows.length} leads</button></div>` : ''}
  </section>`;
}

function renderImportPreview() {
  return `<div class="table-wrap"><table><thead><tr>${importHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${importRows.slice(0, 5).map((row) => `<tr>${importHeaders.map((header) => `<td>${escapeHtml(row[header] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderModal() {
  if (!modal) return '';
  const selected = leads.find((lead) => lead.id === selectedLeadId);
  if (modal === 'new') return modalShell('Adicionar lead', 'Cadastre uma nova oportunidade no CRM Design.', renderLeadForm());
  if (modal === 'edit' && selected) return modalShell('Editar lead', 'Atualize dados, etapa e contexto da oportunidade.', renderLeadForm(selected));
  if (modal === 'profile' && selected) return modalShell('Perfil do lead', '', renderLeadProfile(selected));
  return '';
}

function modalShell(title: string, description: string, content: string) {
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><header class="modal-header"><div><p class="eyebrow">CRM Design</p><h2>${title}</h2>${description ? `<p>${description}</p>` : ''}</div><button class="button button-ghost" data-action="close-modal">×</button></header>${content}</section></div>`;
}

function renderLeadForm(lead?: Lead) {
  const draft = lead ?? blankLead();
  return `<form class="lead-form" id="lead-form"><div class="form-grid two-columns">
    ${input('nome', 'Nome', draft.nome, true)}${input('empresa', 'Empresa', draft.empresa)}${input('email', 'E-mail', draft.email, false, 'email')}${input('telefone', 'Telefone / WhatsApp', draft.telefone)}${input('instagram', 'Instagram', draft.instagram)}${input('site', 'Site', draft.site)}${input('origem', 'Origem', draft.origem)}${input('servicoInteresse', 'Serviço de interesse', draft.servicoInteresse)}${input('orcamentoEstimado', 'Orçamento estimado', String(draft.orcamentoEstimado), false, 'number')}
    <label class="field"><span>Etapa</span><select name="pipelineStageId">${stages.map((stage) => `<option value="${stage.id}" ${draft.pipelineStageId === stage.id ? 'selected' : ''}>${stage.title}</option>`).join('')}</select></label>
  </div><label class="field"><span>Observações</span><textarea name="observacoes" rows="4">${escapeHtml(draft.observacoes)}</textarea></label><div class="form-actions"><button class="button button-secondary" type="button" data-action="close-modal">Cancelar</button><button class="button button-primary" type="submit">${lead ? 'Salvar alterações' : 'Adicionar lead'}</button></div></form>`;
}

function input(name: string, label: string, value: string, required = false, type = 'text') {
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${escapeAttr(value)}" ${required ? 'required' : ''} /></label>`;
}

function renderLeadProfile(lead: Lead) {
  const sortedActivities = [...lead.activities].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="profile-grid"><section class="card profile-main"><div class="profile-hero"><div><p class="eyebrow">Perfil do lead</p><h2>${escapeHtml(lead.nome)}</h2><p>${escapeHtml(lead.empresa || 'Empresa não informada')} · ${escapeHtml(lead.servicoInteresse || 'Serviço a definir')}</p></div><button class="button button-primary" data-action="edit-lead">Editar dados</button></div><div class="profile-details"><span>✉ ${escapeHtml(lead.email || 'Sem e-mail')}</span><span>☎ ${escapeHtml(lead.telefone || 'Sem telefone')}</span><span>↗ ${escapeHtml(lead.instagram || lead.site || 'Sem redes cadastradas')}</span><span>🏆 ${money(lead.orcamentoEstimado)}</span></div><label class="field"><span>Etapa da conversão</span><select data-profile-stage="${lead.id}">${stages.map((stage) => `<option value="${stage.id}" ${lead.pipelineStageId === stage.id ? 'selected' : ''}>${stage.title}</option>`).join('')}</select></label><div class="notes-box"><h3>Observações</h3><p>${escapeHtml(lead.observacoes || 'Nenhuma observação registrada.')}</p></div></section><section class="card activity-panel"><div class="section-heading"><div><p class="eyebrow">Contato</p><h3>Atividades e follow-ups</h3></div><span>◷</span></div><form class="activity-form" id="activity-form"><label class="field"><span>Tipo</span><select name="type">${(['Ligação', 'WhatsApp', 'E-mail', 'Reunião', 'Proposta', 'Follow-up', 'Nota'] as ActivityType[]).map((type) => `<option>${type}</option>`).join('')}</select></label><label class="field"><span>Resumo do contato</span><textarea name="description" rows="3" required placeholder="Ex.: pediu proposta com 2 opções de investimento."></textarea></label><label class="field"><span>Próximo follow-up</span><input name="nextFollowUp" type="date" /></label><button class="button button-primary" type="submit">+ Registrar atividade</button></form><div class="timeline">${sortedActivities.length ? sortedActivities.map((activity) => `<article class="timeline-item"><strong>${escapeHtml(activity.type)}</strong><time>${dateBr(activity.date)}</time><p>${escapeHtml(activity.description)}</p>${activity.nextFollowUp ? `<small>Follow-up: ${dateBr(activity.nextFollowUp)}</small>` : ''}</article>`).join('') : '<p class="empty-state">Nenhuma atividade registrada ainda.</p>'}</div></section></div>`;
}

function bindEvents() {
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => button.addEventListener('click', () => { view = button.dataset.view as View; render(); }));
  document.querySelector<HTMLInputElement>('#search')?.addEventListener('input', (event) => { search = (event.target as HTMLInputElement).value; render(); });
  document.querySelectorAll<HTMLElement>('[data-open]').forEach((element) => element.addEventListener('click', () => { selectedLeadId = element.dataset.open ?? ''; modal = 'profile'; render(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => button.addEventListener('click', () => updateStage(button.dataset.move ?? '', button.dataset.stage as StageId)));
  document.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => element.addEventListener('click', (event) => handleAction(event, element.dataset.action ?? '')));
  document.querySelector<HTMLFormElement>('#lead-form')?.addEventListener('submit', handleLeadSubmit);
  document.querySelector<HTMLFormElement>('#activity-form')?.addEventListener('submit', handleActivitySubmit);
  document.querySelector<HTMLSelectElement>('[data-profile-stage]')?.addEventListener('change', (event) => updateStage(selectedLeadId, (event.target as HTMLSelectElement).value as StageId));
  document.querySelector<HTMLInputElement>('#lead-file')?.addEventListener('change', (event) => void parseLeadFile((event.target as HTMLInputElement).files?.[0]));
  document.querySelectorAll<HTMLSelectElement>('[data-map]').forEach((select) => select.addEventListener('change', () => { importMapping[select.dataset.map as LeadImportField] = select.value; render(); }));
}

function handleAction(event: Event, action: string) {
  if ((event.target as HTMLElement).closest('.modal') && action === 'close-modal' && (event.target as HTMLElement).classList.contains('modal-backdrop')) return;
  if (action === 'new-lead') modal = 'new';
  if (action === 'close-modal') modal = null;
  if (action === 'edit-lead') modal = 'edit';
  if (action === 'export') exportLeads();
  if (action === 'clear-import') { importRows = []; importHeaders = []; importMapping = emptyMapping(); importMessage = ''; }
  if (action === 'confirm-import') confirmImport();
  render();
}

function handleLeadSubmit(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const draft = formToDraft(data);
  const existingIndex = selectedLeadId ? leads.findIndex((lead) => lead.id === selectedLeadId) : -1;
  if (modal === 'edit' && existingIndex >= 0) {
    leads[existingIndex] = { ...leads[existingIndex], ...draft, updatedAt: new Date().toISOString() };
  } else {
    leads.unshift({ ...draft, id: createId('lead'), activities: [], createdAt: now, updatedAt: new Date().toISOString() });
  }
  saveLeads();
  modal = null;
  render();
}

function handleActivitySubmit(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const lead = leads.find((item) => item.id === selectedLeadId);
  if (!lead) return;
  lead.activities.unshift({ id: createId('activity'), type: String(data.get('type')) as ActivityType, description: String(data.get('description') ?? ''), date: new Date().toISOString(), nextFollowUp: String(data.get('nextFollowUp') || '') || undefined });
  lead.updatedAt = new Date().toISOString();
  saveLeads();
  render();
}

async function parseLeadFile(file?: File) {
  if (!file) return;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const text = await file.text();
  try {
    if (extension === 'xls' && text.trim().startsWith('<')) {
      importRows = parseHtmlTable(text);
    } else if (extension === 'xls' || extension === 'xlsx') {
      throw new Error('para importar planilhas binárias XLS/XLSX neste modo sem dependências, salve a planilha como CSV e envie novamente. Arquivos .xls baseados em HTML são aceitos.');
    } else if (extension === 'json') {
      const parsed = JSON.parse(text) as ImportRow[];
      importRows = Array.isArray(parsed) ? parsed.map(stringifyRow) : [];
    } else {
      importRows = parseDelimited(text, extension === 'tsv' ? '\t' : detectDelimiter(text));
    }
    importHeaders = Object.keys(importRows[0] ?? {});
    importMapping = autoMap(importHeaders);
    importMessage = `Arquivo ${file.name} carregado para prévia.`;
  } catch (error) {
    importMessage = `Erro: ${(error as Error).message}`;
  }
  render();
}

function confirmImport() {
  const imported = importRows.filter((row) => (row[importMapping.nome] ?? '').trim()).map(rowToDraft);
  leads.unshift(...imported.map((draft) => ({ ...draft, id: createId('lead'), activities: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })));
  saveLeads();
  importRows = [];
  importHeaders = [];
  importMapping = emptyMapping();
  importMessage = `${imported.length} leads importados com sucesso.`;
  view = 'pipeline';
}

function parseHtmlTable(text: string): ImportRow[] {
  const documentTable = new DOMParser().parseFromString(text, 'text/html');
  const rows = Array.from(documentTable.querySelectorAll('tr')).map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent?.trim() ?? ''));
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function parseDelimited(text: string, delimiter: string): ImportRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0], delimiter).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
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
  const header = text.split(/\r?\n/)[0] ?? '';
  return header.includes(';') ? ';' : ',';
}

function rowToDraft(row: ImportRow): LeadDraft {
  const read = (field: LeadImportField) => row[importMapping[field]]?.trim() ?? '';
  return { nome: read('nome'), empresa: read('empresa'), email: read('email'), telefone: read('telefone'), instagram: read('instagram'), site: read('site'), origem: read('origem'), servicoInteresse: read('servicoInteresse'), orcamentoEstimado: Number(read('orcamentoEstimado').replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0, observacoes: read('observacoes'), pipelineStageId: 'new' };
}

function formToDraft(data: FormData): LeadDraft {
  return { nome: String(data.get('nome') ?? ''), empresa: String(data.get('empresa') ?? ''), email: String(data.get('email') ?? ''), telefone: String(data.get('telefone') ?? ''), instagram: String(data.get('instagram') ?? ''), site: String(data.get('site') ?? ''), origem: String(data.get('origem') ?? ''), servicoInteresse: String(data.get('servicoInteresse') ?? ''), orcamentoEstimado: Number(data.get('orcamentoEstimado')) || 0, observacoes: String(data.get('observacoes') ?? ''), pipelineStageId: String(data.get('pipelineStageId')) as StageId };
}

function updateStage(leadId: string, stageId: StageId) {
  leads = leads.map((lead) => lead.id === leadId ? { ...lead, pipelineStageId: stageId, updatedAt: new Date().toISOString() } : lead);
  saveLeads();
  render();
}

function buildMetrics() {
  const openLeads = leads.filter((lead) => lead.pipelineStageId !== 'won' && lead.pipelineStageId !== 'lost');
  const wonLeads = leads.filter((lead) => lead.pipelineStageId === 'won');
  return { open: openLeads.length, won: wonLeads.length, pipelineValue: openLeads.reduce((sum, lead) => sum + lead.orcamentoEstimado, 0), wonValue: wonLeads.reduce((sum, lead) => sum + lead.orcamentoEstimado, 0) };
}

function filteredLeads() {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return leads;
  return leads.filter((lead) => [lead.nome, lead.empresa, lead.email, lead.telefone, lead.origem, lead.servicoInteresse].join(' ').toLowerCase().includes(normalized));
}

function loadLeads(): Lead[] {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as Lead[]; } catch { return []; }
}

function saveLeads() {
  localStorage.setItem(storageKey, JSON.stringify(leads));
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

function seedLeads(): Lead[] {
  return [
    { ...blankLead(), id: 'lead-aurora', nome: 'Marina Torres', empresa: 'Aurora Café', email: 'marina@auroracafe.com', telefone: '(11) 98888-0190', instagram: '@auroracafe', site: 'https://auroracafe.com', origem: 'Instagram', servicoInteresse: 'Identidade visual', orcamentoEstimado: 6500, observacoes: 'Quer reposicionar a marca para abrir uma segunda unidade.', pipelineStageId: 'briefing', activities: [{ id: 'activity-1', type: 'WhatsApp', description: 'Enviou referências visuais e pediu agenda para briefing.', date: now, nextFollowUp: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) }], createdAt: now, updatedAt: now },
    { ...blankLead(), id: 'lead-nova', nome: 'Rafael Lima', empresa: 'NovaFit Studio', email: 'rafael@novafit.com', telefone: '(21) 97777-2201', instagram: '@novafitstudio', site: 'https://novafit.example', origem: 'Indicação', servicoInteresse: 'Landing page de vendas', orcamentoEstimado: 4200, observacoes: 'Precisa lançar campanha em até 30 dias.', pipelineStageId: 'proposal', activities: [{ id: 'activity-2', type: 'Proposta', description: 'Proposta enviada com duas opções de escopo.', date: now, nextFollowUp: new Date(Date.now() + 172_800_000).toISOString().slice(0, 10) }], createdAt: now, updatedAt: now },
    { ...blankLead(), id: 'lead-bossa', nome: 'Camila Rocha', empresa: 'Bossa Decor', email: 'camila@bossadecor.com', telefone: '(31) 96666-3302', instagram: '@bossadecor', origem: 'Formulário do site', servicoInteresse: 'Social media kit', orcamentoEstimado: 2800, observacoes: 'Comparando fornecedores para pacote mensal.', pipelineStageId: 'first-contact', activities: [], createdAt: now, updatedAt: now },
  ];
}

function blankLead(): Lead {
  return { id: '', nome: '', empresa: '', email: '', telefone: '', instagram: '', site: '', origem: '', servicoInteresse: '', orcamentoEstimado: 0, observacoes: '', pipelineStageId: 'new', activities: [], createdAt: '', updatedAt: '' };
}

function emptyMapping(): Record<LeadImportField, string> {
  return { nome: '', empresa: '', email: '', telefone: '', instagram: '', site: '', origem: '', servicoInteresse: '', orcamentoEstimado: '', observacoes: '' };
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

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char] ?? char));
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

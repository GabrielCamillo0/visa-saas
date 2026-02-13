'use client';

import { useState, useRef } from 'react';

export type SubmissionFormData = {
  nomeCompleto: string;
  email: string;
  telefone: string;
  nacionalidade: string;
  paisNascimento: string;
  dataNascimento: string;
  estadoCivil: 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'outro';
  numDependentes: string;
  proposito: 'study' | 'work' | 'business' | 'tourism' | 'immigration';
  resumoObjetivo: string;
  tipoImigracaoInteresse: string;
  educacao: string;
  anosExperiencia: string;
  areaOcupacao: string;
  nivelIngles: string;
  detalhesProposito: string;
  ofertaEmprego: boolean;
  ofertaEmpregoDetalhes: string;
  experienciaMultinacionalAnos: string;
  premiosPublicacoes: string;
  possuiNegocio: boolean;
  detalhesNegocio: string;
  investimentoDisponivel: string;
  paisTratadoComercio: string;
  quemFinancia: 'proprio' | 'sponsor' | 'empresa';
  comprovacaoFundos: string;
  temSponsorEua: boolean;
  quemSponsor: string;
  familiaNosEua: string;
  cidadeEstadoInteresse: string;
  vinculosEmprego: string;
  vinculosFamilia: string;
  jaEsteveEua: boolean;
  quandoEua: string;
  entradaPrevista: string;
  saidaPrevista: string;
  duracaoEstimada: string;
  observacoes: string;
};

const emptyForm: SubmissionFormData = {
  nomeCompleto: '',
  email: '',
  telefone: '',
  nacionalidade: '',
  paisNascimento: '',
  dataNascimento: '',
  estadoCivil: 'solteiro',
  numDependentes: '',
  proposito: 'tourism',
  resumoObjetivo: '',
  tipoImigracaoInteresse: '',
  educacao: '',
  anosExperiencia: '',
  areaOcupacao: '',
  nivelIngles: '',
  detalhesProposito: '',
  ofertaEmprego: false,
  ofertaEmpregoDetalhes: '',
  experienciaMultinacionalAnos: '',
  premiosPublicacoes: '',
  possuiNegocio: false,
  detalhesNegocio: '',
  investimentoDisponivel: '',
  paisTratadoComercio: '',
  quemFinancia: 'proprio',
  comprovacaoFundos: '',
  temSponsorEua: false,
  quemSponsor: '',
  familiaNosEua: '',
  cidadeEstadoInteresse: '',
  vinculosEmprego: '',
  vinculosFamilia: '',
  jaEsteveEua: false,
  quandoEua: '',
  entradaPrevista: '',
  saidaPrevista: '',
  duracaoEstimada: '',
  observacoes: '',
};

function formToRawText(data: SubmissionFormData): string {
  const lines: string[] = [];
  lines.push('[Identificação]');
  lines.push(`- Nome completo: ${data.nomeCompleto.trim() || '—'}`);
  lines.push(`- E-mail: ${data.email.trim() || '—'}`);
  lines.push(`- Telefone: ${data.telefone.trim() || '—'}`);
  lines.push(`- Nacionalidade: ${data.nacionalidade.trim() || '—'}`);
  lines.push(`- País de nascimento: ${data.paisNascimento.trim() || '—'}`);
  lines.push(`- Data de nascimento (AAAA-MM-DD): ${data.dataNascimento.trim() || '—'}`);
  lines.push(`- Estado civil: ${data.estadoCivil}`);
  lines.push(`- Número de dependentes: ${data.numDependentes.trim() || '—'}`);
  lines.push('');
  lines.push('[Propósito da viagem] (use EXATAMENTE um: study | work | business | tourism | immigration)');
  lines.push(`- Propósito: ${data.proposito}`);
  if (data.proposito === 'immigration' && data.tipoImigracaoInteresse.trim()) {
    lines.push(`- Interesse em imigração (família/emprego/investimento/DV/habilidade): ${data.tipoImigracaoInteresse.trim()}`);
  }
  lines.push('');
  lines.push('[Resumo do caso]');
  lines.push(`- Objetivo principal (1–3 frases): ${data.resumoObjetivo.trim() || '—'}`);
  lines.push('');
  lines.push('[Educação e idioma]');
  lines.push(`- Nível/curso atual ou planejado: ${data.educacao.trim() || '—'}`);
  lines.push(`- Nível de inglês: ${data.nivelIngles.trim() || '—'}`);
  lines.push('');
  lines.push('[Experiência profissional]');
  lines.push(`- Anos de experiência (número): ${data.anosExperiencia.trim() || '—'}`);
  lines.push(`- Área/ocupação: ${data.areaOcupacao.trim() || '—'}`);
  lines.push(`- Oferta de emprego nos EUA? (true/false): ${data.ofertaEmprego}`);
  if (data.ofertaEmprego) lines.push(`- Detalhes da oferta (empregador, cargo): ${data.ofertaEmpregoDetalhes.trim() || '—'}`);
  lines.push(`- Anos de experiência em empresa multinacional (L1/EB1C): ${data.experienciaMultinacionalAnos.trim() || '—'}`);
  lines.push(`- Prêmios, publicações, evidências (O1/EB1A/NIW): ${data.premiosPublicacoes.trim() || '—'}`);
  lines.push('');
  lines.push('[Negócio / Investimento]');
  lines.push(`- Possui ou pretende abrir negócio? (true/false): ${data.possuiNegocio}`);
  if (data.possuiNegocio) lines.push(`- Detalhes do negócio: ${data.detalhesNegocio.trim() || '—'}`);
  lines.push(`- Investimento disponível (USD, para EB-5/E2): ${data.investimentoDisponivel.trim() || '—'}`);
  lines.push(`- País do tratado de comércio (E-1/E-2, se aplicável): ${data.paisTratadoComercio.trim() || '—'}`);
  lines.push('');
  lines.push('[Detalhes específicos do propósito]');
  lines.push(`  ${data.detalhesProposito.trim() || '—'}`);
  lines.push('');
  lines.push('[Financiamento]');
  lines.push(`- Quem vai financiar (próprio/sponsor/empresa): ${data.quemFinancia}`);
  lines.push(`- Comprovação de fundos (se houver): ${data.comprovacaoFundos.trim() || '—'}`);
  lines.push('');
  lines.push('[Sponsor e família nos EUA]');
  lines.push(`- Existe sponsor nos EUA? (true/false): ${data.temSponsorEua}`);
  lines.push(`- Quem é o sponsor (se true): ${data.quemSponsor.trim() || '—'}`);
  lines.push(`- Família nos EUA (parentesco, cidadão/LPR): ${data.familiaNosEua.trim() || '—'}`);
  lines.push(`- Cidade/estado de interesse nos EUA: ${data.cidadeEstadoInteresse.trim() || '—'}`);
  lines.push('');
  lines.push('[Vínculos no país de origem]');
  lines.push(`- Emprego/negócio atual: ${data.vinculosEmprego.trim() || '—'}`);
  lines.push(`- Família/bens/estudos em andamento: ${data.vinculosFamilia.trim() || '—'}`);
  lines.push('');
  lines.push('[Histórico de EUA]');
  lines.push(`- Já esteve nos EUA? (true/false): ${data.jaEsteveEua}`);
  lines.push(`- Quando e por quanto tempo (se true): ${data.quandoEua.trim() || '—'}`);
  lines.push('');
  lines.push('[Datas]');
  lines.push(`- Entrada prevista (AAAA-MM-DD ou aproximado): ${data.entradaPrevista.trim() || '—'}`);
  lines.push(`- Saída prevista (AAAA-MM-DD ou aproximado): ${data.saidaPrevista.trim() || '—'}`);
  lines.push(`- Duração total estimada: ${data.duracaoEstimada.trim() || '—'}`);
  lines.push('');
  lines.push('[Observações]');
  lines.push(`- Informações adicionais: ${data.observacoes.trim() || '—'}`);
  return lines.join('\n');
}

type Props = {
  onSubmit: (payload: { rawText: string; applicantName: string; applicantPhone: string }) => Promise<void>;
};

export default function SubmissionForm({ onSubmit }: Props) {
  const [form, setForm] = useState<SubmissionFormData>(emptyForm);
  const [uploadedRawText, setUploadedRawText] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof SubmissionFormData>(key: K, value: SubmissionFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSubmitError(null);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setFileStatus('uploading');
    const formData = new FormData();
    formData.set('file', file);
    try {
      const res = await fetch('/api/submissions/extract-file', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) {
        setFileError(json?.message ?? json?.error ?? 'Falha ao processar arquivo.');
        setFileStatus('error');
        return;
      }
      if (typeof json.text === 'string' && json.text.trim().length > 0) {
        setUploadedRawText(json.text.trim());
        setSubmitError(null);
      }
      setFileStatus('idle');
    } catch {
      setFileError('Erro de rede ao enviar o arquivo.');
      setFileStatus('error');
    }
    e.target.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const rawText = uploadedRawText ?? formToRawText(form);
    const trimmed = rawText.trim();
    if (trimmed.length < 20) {
      setSubmitError('Preencha os campos obrigatórios ou envie um arquivo PDF/DOCX.');
      return;
    }
    const applicantName = form.nomeCompleto.trim() || (uploadedRawText ? '—' : '');
    const applicantPhone = form.telefone.trim() || '';
    if (!uploadedRawText && !applicantName) {
      setSubmitError('Preencha o nome completo.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ rawText: trimmed, applicantName, applicantPhone });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao criar submissão.');
    } finally {
      setSubmitting(false);
    }
  }

  const formLabel = 'block text-sm font-semibold text-[var(--text-main)] mb-1.5';
  const formInput = 'input';
  const formSection = 'space-y-4 pt-6 first:pt-0';
  const formLegend = 'text-lg font-semibold text-[var(--text-main)] mb-4 pb-2 border-b border-[var(--border-default)]';

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      <p className="text-base text-[var(--text-muted)] leading-relaxed">
        Preencha os dados abaixo para análise de visto. Os fatos são extraídos automaticamente após o envio.
      </p>

      {/* Opção: importar de PDF/DOCX */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-[var(--bg-muted)]/50 border border-[var(--border-default)]">
        <label className="px-4 py-2.5 text-sm font-medium rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[var(--bg-muted)] cursor-pointer transition">
          Importar de PDF ou DOCX
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={onFileChange}
          />
        </label>
        {uploadedRawText !== null && (
          <span className="text-sm font-medium text-[var(--success-soft)]">Arquivo importado (os dados serão usados no envio).</span>
        )}
        {fileStatus === 'uploading' && <span className="text-sm text-[var(--text-subtle)]">Processando…</span>}
        {fileStatus === 'error' && fileError && <span className="text-sm text-[var(--danger)]">{fileError}</span>}
      </div>

      <hr className="border-[var(--border-default)] my-8" />

      <fieldset className={formSection}>
        <legend className={formLegend}>Identificação</legend>
        <div className="space-y-4">
          <div>
            <label className={formLabel}>Nome completo *</label>
            <input
              type="text"
              value={form.nomeCompleto}
              onChange={(e) => update('nomeCompleto', e.target.value)}
              className={formInput}
              required={uploadedRawText === null}
            />
          </div>
          <div>
            <label className={formLabel}>E-mail *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className={formInput}
              placeholder="ex.: seu@email.com"
              required={uploadedRawText === null}
            />
          </div>
          <div>
            <label className={formLabel}>Telefone *</label>
            <input
              type="tel"
              value={form.telefone}
              onChange={(e) => update('telefone', e.target.value)}
              className={formInput}
              placeholder="ex.: +55 11 99999-9999"
              required={uploadedRawText === null}
            />
          </div>
          <div>
            <label className={formLabel}>Nacionalidade *</label>
            <input
              type="text"
              value={form.nacionalidade}
              onChange={(e) => update('nacionalidade', e.target.value)}
              className={formInput}
              placeholder="ex.: brasileira"
              required={uploadedRawText === null}
            />
          </div>
          <div>
            <label className={formLabel}>País de nascimento</label>
            <input
              type="text"
              value={form.paisNascimento}
              onChange={(e) => update('paisNascimento', e.target.value)}
              className={formInput}
              placeholder="ex.: Brasil (relevante para DV)"
            />
          </div>
          <div>
            <label className={formLabel}>Data de nascimento (AAAA-MM-DD) *</label>
            <input
              type="text"
              value={form.dataNascimento}
              onChange={(e) => update('dataNascimento', e.target.value)}
              className={formInput}
              placeholder="ex.: 1990-05-15"
              required={uploadedRawText === null}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={formLabel}>Estado civil</label>
              <select
                value={form.estadoCivil}
                onChange={(e) => update('estadoCivil', e.target.value as SubmissionFormData['estadoCivil'])}
                className={formInput}
              >
              <option value="solteiro">Solteiro(a)</option>
              <option value="casado">Casado(a)</option>
              <option value="divorciado">Divorciado(a)</option>
              <option value="viuvo">Viúvo(a)</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div>
            <label className={formLabel}>Número de dependentes</label>
            <input
              type="text"
              value={form.numDependentes}
              onChange={(e) => update('numDependentes', e.target.value)}
              className={formInput}
              placeholder="ex.: 0, 1, 2"
            />
          </div>
        </div>
        </div>
      </fieldset>

      <fieldset className={formSection}>
        <legend className={formLegend}>Propósito da viagem</legend>
        <div className="space-y-4">
          <div>
            <label className={formLabel}>Propósito *</label>
            <select
              value={form.proposito}
              onChange={(e) => update('proposito', e.target.value as SubmissionFormData['proposito'])}
              className={formInput}
            >
            <option value="study">study</option>
            <option value="work">work</option>
            <option value="business">business</option>
            <option value="tourism">tourism</option>
            <option value="immigration">immigration</option>
          </select>
        </div>
        <div>
            <label className={formLabel}>Objetivo principal (1–3 frases) *</label>
            <textarea
              value={form.resumoObjetivo}
              onChange={(e) => update('resumoObjetivo', e.target.value)}
              className={`${formInput} min-h-[80px] resize-y`}
              placeholder="Descreva brevemente o objetivo da viagem ou do pedido."
              required={uploadedRawText === null}
            />
          </div>
          {form.proposito === 'immigration' && (
            <div>
              <label className={formLabel}>Tipo de imigração de interesse</label>
              <input
                type="text"
                value={form.tipoImigracaoInteresse}
                onChange={(e) => update('tipoImigracaoInteresse', e.target.value)}
                className={formInput}
                placeholder="ex.: família, emprego, investimento (EB-5), DV, habilidade extraordinária (EB-1A/O-1)"
              />
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className={formSection}>
        <legend className={formLegend}>Educação e experiência</legend>
        <div className="space-y-4">
          <div>
            <label className={formLabel}>Nível/curso atual ou planejado</label>
            <input
              type="text"
              value={form.educacao}
              onChange={(e) => update('educacao', e.target.value)}
              className={formInput}
              placeholder="ex.: Superior completo em Administração"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={formLabel}>Anos de experiência</label>
              <input
                type="text"
                value={form.anosExperiencia}
                onChange={(e) => update('anosExperiencia', e.target.value)}
                className={formInput}
                placeholder="ex.: 8"
              />
            </div>
            <div>
              <label className={formLabel}>Área/ocupação</label>
              <input
                type="text"
                value={form.areaOcupacao}
                onChange={(e) => update('areaOcupacao', e.target.value)}
                className={formInput}
                placeholder="ex.: Gerente de projetos"
              />
            </div>
          </div>
          <div>
            <label className={formLabel}>Nível de inglês</label>
            <select
              value={form.nivelIngles}
              onChange={(e) => update('nivelIngles', e.target.value)}
              className={formInput}
            >
            <option value="">—</option>
            <option value="básico">Básico</option>
            <option value="intermediário">Intermediário</option>
            <option value="avançado">Avançado</option>
            <option value="fluente">Fluente</option>
            <option value="nativo">Nativo</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ofertaEmprego"
            checked={form.ofertaEmprego}
            onChange={(e) => update('ofertaEmprego', e.target.checked)}
            className="rounded border-[var(--border-default)] text-[var(--primary)]"
          />
          <label htmlFor="ofertaEmprego" className="text-sm font-medium text-[var(--text-main)]">Possui oferta de emprego nos EUA?</label>
        </div>
        {form.ofertaEmprego && (
          <div>
            <label className={formLabel}>Detalhes (empregador, cargo, quando)</label>
            <textarea
              value={form.ofertaEmpregoDetalhes}
              onChange={(e) => update('ofertaEmpregoDetalhes', e.target.value)}
              className={`${formInput} min-h-[60px] resize-y`}
              placeholder="Nome da empresa, cargo, salário (se souber)"
            />
          </div>
        )}
        <div>
          <label className={formLabel}>Anos em empresa multinacional (para L-1 / EB-1C)</label>
          <input
            type="text"
            value={form.experienciaMultinacionalAnos}
            onChange={(e) => update('experienciaMultinacionalAnos', e.target.value)}
            className={formInput}
            placeholder="ex.: 3"
          />
        </div>
        <div>
          <label className={formLabel}>Prêmios, publicações, evidências (O-1 / EB-1A / NIW)</label>
          <textarea
            value={form.premiosPublicacoes}
            onChange={(e) => update('premiosPublicacoes', e.target.value)}
            className={`${formInput} min-h-[60px] resize-y`}
            placeholder="Prêmios, artigos, patentes, apresentações, cartas de especialistas"
          />
        </div>
        <div>
          <label className={formLabel}>Detalhes do propósito (conforme o tipo)</label>
          <textarea
            value={form.detalhesProposito}
            onChange={(e) => update('detalhesProposito', e.target.value)}
            className={`${formInput} min-h-[60px] resize-y`}
            placeholder="Ex.: instituição/curso, empregador, atividades/cidades, base do pedido..."
          />
        </div>
        </div>
      </fieldset>

      <fieldset className={formSection}>
        <legend className={formLegend}>Negócio e investimento</legend>
        <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="possuiNegocio"
            checked={form.possuiNegocio}
            onChange={(e) => update('possuiNegocio', e.target.checked)}
            className="rounded border-[var(--border-default)] text-[var(--primary)]"
          />
          <label htmlFor="possuiNegocio" className="text-sm font-medium text-[var(--text-main)]">Possui ou pretende abrir negócio nos EUA?</label>
        </div>
        {form.possuiNegocio && (
          <div>
            <label className={formLabel}>Detalhes do negócio</label>
            <textarea
              value={form.detalhesNegocio}
              onChange={(e) => update('detalhesNegocio', e.target.value)}
              className={`${formInput} min-h-[60px] resize-y`}
              placeholder="Setor, faturamento, funcionários, plano"
            />
          </div>
        )}
        <div>
          <label className={formLabel}>Investimento disponível (USD) — para EB-5 / E-2</label>
          <input
            type="text"
            value={form.investimentoDisponivel}
            onChange={(e) => update('investimentoDisponivel', e.target.value)}
            className={formInput}
            placeholder="ex.: 500.000 ou não aplicável"
          />
        </div>
        <div>
          <label className={formLabel}>País do tratado de comércio (E-1 / E-2)</label>
          <input
            type="text"
            value={form.paisTratadoComercio}
            onChange={(e) => update('paisTratadoComercio', e.target.value)}
            className={formInput}
            placeholder="ex.: Brasil (se tiver passaporte de país com tratado)"
          />
        </div>
        </div>
      </fieldset>

      <fieldset className={formSection}>
        <legend className={formLegend}>Financiamento</legend>
        <div className="space-y-4">
          <div>
            <label className={formLabel}>Quem vai financiar</label>
            <select
              value={form.quemFinancia}
              onChange={(e) => update('quemFinancia', e.target.value as SubmissionFormData['quemFinancia'])}
              className={formInput}
            >
              <option value="proprio">próprio</option>
              <option value="sponsor">sponsor</option>
              <option value="empresa">empresa</option>
            </select>
          </div>
          <div>
            <label className={formLabel}>Comprovação de fundos (se houver)</label>
            <input
              type="text"
              value={form.comprovacaoFundos}
              onChange={(e) => update('comprovacaoFundos', e.target.value)}
              className={formInput}
              placeholder="ex.: R$ 45.000 em conta corrente"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={formSection}>
        <legend className={formLegend}>Sponsor nos EUA</legend>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="temSponsorEua"
              checked={form.temSponsorEua}
              onChange={(e) => update('temSponsorEua', e.target.checked)}
              className="rounded border-[var(--border-default)] text-[var(--primary)]"
            />
            <label htmlFor="temSponsorEua" className="text-sm font-medium text-[var(--text-main)]">Existe sponsor nos EUA?</label>
          </div>
          {form.temSponsorEua && (
            <div>
              <label className={formLabel}>Quem é o sponsor</label>
              <input
                type="text"
                value={form.quemSponsor}
                onChange={(e) => update('quemSponsor', e.target.value)}
                className={formInput}
              />
            </div>
          )}
          <div>
            <label className={formLabel}>Família nos EUA (parentesco, cidadão/LPR)</label>
            <input
              type="text"
              value={form.familiaNosEua}
              onChange={(e) => update('familiaNosEua', e.target.value)}
              className={formInput}
              placeholder="ex.: cônjuge cidadão, irmão LPR, pais"
            />
          </div>
          <div>
            <label className={formLabel}>Cidade/estado de interesse nos EUA</label>
            <input
              type="text"
              value={form.cidadeEstadoInteresse}
              onChange={(e) => update('cidadeEstadoInteresse', e.target.value)}
              className={formInput}
              placeholder="ex.: Miami, FL ou Texas"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={formSection}>
        <legend className={formLegend}>Vínculos no país de origem</legend>
        <div className="space-y-4">
          <div>
            <label className={formLabel}>Emprego/negócio atual</label>
            <input
              type="text"
              value={form.vinculosEmprego}
              onChange={(e) => update('vinculosEmprego', e.target.value)}
              className={formInput}
              placeholder="ex.: CLT na empresa X desde 2018"
            />
          </div>
          <div>
            <label className={formLabel}>Família/bens/estudos em andamento</label>
            <input
              type="text"
              value={form.vinculosFamilia}
              onChange={(e) => update('vinculosFamilia', e.target.value)}
              className={formInput}
              placeholder="ex.: Casa própria, família no Brasil"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={formSection}>
        <legend className={formLegend}>Histórico de EUA</legend>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="jaEsteveEua"
              checked={form.jaEsteveEua}
              onChange={(e) => update('jaEsteveEua', e.target.checked)}
              className="rounded border-[var(--border-default)] text-[var(--primary)]"
            />
            <label htmlFor="jaEsteveEua" className="text-sm font-medium text-[var(--text-main)]">Já esteve nos EUA?</label>
          </div>
          {form.jaEsteveEua && (
            <div>
              <label className={formLabel}>Quando e por quanto tempo</label>
              <input
                type="text"
                value={form.quandoEua}
                onChange={(e) => update('quandoEua', e.target.value)}
                className={formInput}
                placeholder="ex.: 2024/09, 10 dias"
              />
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className={formSection}>
        <legend className={formLegend}>Datas</legend>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={formLabel}>Entrada prevista (AAAA-MM-DD ou aproximado)</label>
              <input
                type="text"
                value={form.entradaPrevista}
                onChange={(e) => update('entradaPrevista', e.target.value)}
                className={formInput}
                placeholder="ex.: 2026-07-01"
              />
            </div>
            <div>
              <label className={formLabel}>Saída prevista (AAAA-MM-DD ou aproximado)</label>
              <input
                type="text"
                value={form.saidaPrevista}
                onChange={(e) => update('saidaPrevista', e.target.value)}
                className={formInput}
                placeholder="ex.: 2026-07-15"
              />
            </div>
          </div>
          <div>
            <label className={formLabel}>Duração total estimada</label>
            <input
              type="text"
              value={form.duracaoEstimada}
              onChange={(e) => update('duracaoEstimada', e.target.value)}
              className={formInput}
              placeholder="ex.: 15 dias ou 6 meses"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={formSection}>
        <legend className={formLegend}>Observações</legend>
        <div>
          <label className={formLabel}>Informações adicionais</label>
          <textarea
            value={form.observacoes}
            onChange={(e) => update('observacoes', e.target.value)}
            className={`${formInput} min-h-[80px] resize-y`}
            placeholder="Informações adicionais objetivas"
          />
        </div>
      </fieldset>

      {submitError && <p className="text-sm font-medium text-[var(--danger)]">{submitError}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="btn-primary py-3 px-6 disabled:opacity-60"
      >
        {submitting ? 'Criando…' : 'Criar submissão'}
      </button>
    </form>
  );
}

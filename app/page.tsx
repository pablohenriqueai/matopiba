'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { Activity, ArrowDown, ArrowRight, Bug, Check, CircleHelp, Clock3, CloudUpload, FileImage, Leaf, LoaderCircle, Search, ShieldCheck, Sprout, Wheat, X } from 'lucide-react'

type ModelStatus = { id: string; state: string; detail: string; classes: string[] }
type Result = { id: string; created_at: string; filename: string; model: string; result: string; confidence: number | null; payload: Record<string, any>; annotated_url?: string; original_image?: string; probabilities?: Record<string, number>; detections?: { class: string; confidence: number; xyxy: number[] }[] }
const API = process.env.NEXT_PUBLIC_SOJAO_API_URL || 'http://localhost:8000'
const modules = [
  { id: 'folhas', title: 'Saúde foliar', subtitle: 'Identifique sinais de pragas em folhas de soja.', metric: '3 classes', icon: Leaf, tint: 'sage' },
  { id: 'insetos', title: 'Detecção de insetos', subtitle: 'Localize e classifique insetos na imagem.', metric: '12 classes', icon: Bug, tint: 'gold' },
  { id: 'daninhas', title: 'Recortes de daninhas', subtitle: 'Classifique recortes de plantas e solo.', metric: '4 classes', icon: Wheat, tint: 'blue' },
]
const labels: Record<string, string> = { folhas: 'Saúde foliar', insetos: 'Insetos', daninhas: 'Recortes de daninhas' }
const fetcher = async (url: string) => { const response = await fetch(url); if (!response.ok) throw new Error('API indisponível'); return response.json() }

export default function Home() {
  const [section, setSection] = useState<'inicio'|'analise'|'historico'>('inicio')
  const [model, setModel] = useState('folhas')
  const [files, setFiles] = useState<File[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [historyModel, setHistoryModel] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confidence, setConfidence] = useState(25)
  const [iou, setIou] = useState(45)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: statusData, error: statusError } = useSWR(`${API}/api/models/status`, fetcher, { shouldRetryOnError: false, revalidateOnFocus: false })
  const statuses: ModelStatus[] = statusData?.models || []
  const historyParams = new URLSearchParams()
  if (historyModel) historyParams.set('model', historyModel)
  if (query) historyParams.set('q', query)
  if (dateFrom) historyParams.set('date_from', dateFrom)
  if (dateTo) historyParams.set('date_to', dateTo)
  const historyKey = section === 'historico' ? `${API}/api/history?${historyParams.toString()}` : null
  const { data: historyData, error: historyError, mutate: refreshHistory } = useSWR(historyKey, fetcher, { shouldRetryOnError: false, revalidateOnFocus: false })
  const readyCount = statuses.filter(s => s.state === 'ready').length
  const chosenStatus = statuses.find(s => s.id === model)
  const filteredHistory: Result[] = historyData?.items || []
  const addFiles = (list: FileList | null) => {
    if (!list) return
    const incoming = Array.from(list)
    const accepted: File[] = []
    const rejected: string[] = []
    for (const file of incoming) {
      if (!/^image\/(jpeg|png|webp|bmp|tiff)$/.test(file.type) && !/\.(jpe?g|png|webp|bmp|tif?f)$/i.test(file.name)) rejected.push(file.name)
      else if (file.size > 20 * 1024 * 1024) rejected.push(`${file.name} (acima de 20 MB)`)
      else accepted.push(file)
    }
    setFiles(current => [...current, ...accepted])
    setError(rejected.length ? `Arquivos não aceitos: ${rejected.join(', ')}` : '')
  }
  const analyze = async () => {
    if (!files.length) { setError('Adicione pelo menos uma imagem para começar.'); return }
    setBusy(true); setError(''); setResults([])
    try {
      const form = new FormData(); files.forEach(file => form.append('files', file))
      const endpoint = model === 'insetos' ? `${API}/api/analyze/insetos?confidence=${confidence / 100}&iou=${iou / 100}` : `${API}/api/analyze/${model}`
      const response = await fetch(endpoint, { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Não foi possível concluir a análise.')
      setResults(data.results || [])
      await refreshHistory()
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha de conexão com a API. Verifique se o backend está ativo.') }
    finally { setBusy(false) }
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <a href="#inicio" className="brand" onClick={() => setSection('inicio')}><span className="brand-mark"><Sprout size={21}/></span><span>SoJão<small>INTELIGÊNCIA AGRÍCOLA</small></span></a>
      <div className="workspace-label">ESPAÇO DE TRABALHO</div>
      <nav className="side-nav" aria-label="Navegação principal">
        <button className={section === 'inicio' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('inicio')}><Activity size={17}/> Visão geral</button>
        <button className={section === 'analise' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('analise')}><FileImage size={17}/> Nova análise</button>
        <button className={section === 'historico' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('historico')}><Clock3 size={17}/> Histórico</button>
      </nav>
      <div className="sidebar-bottom"><div className="status-card"><span className="status-dot"/><div><strong>{readyCount} de 3 modelos ativos</strong><small>{statuses.length ? 'Status da API atualizado' : 'API não conectada'}</small></div></div><button className="help-link"><CircleHelp size={16}/> Sobre o SoJão</button></div>
    </aside>

    <section className="main-area">
      <header className="topbar"><button className="mobile-brand" onClick={() => setSection('inicio')}><Sprout size={20}/> SoJão</button><div className="breadcrumb">Workspace <span>/</span> {section === 'inicio' ? 'Visão geral' : section === 'historico' ? 'Histórico' : 'Nova análise'}</div><div className="topbar-right"><span className="local-tag"><span/> Ambiente local</span><span className="avatar">SJ</span></div></header>
      <nav className="mobile-nav" aria-label="Navegação principal"><button className={section === 'inicio' ? 'active' : ''} onClick={() => setSection('inicio')}><Activity size={15}/> Visão geral</button><button className={section === 'analise' ? 'active' : ''} onClick={() => setSection('analise')}><FileImage size={15}/> Nova análise</button><button className={section === 'historico' ? 'active' : ''} onClick={() => setSection('historico')}><Clock3 size={15}/> Histórico</button></nav>
      <div className="content">
        {section === 'inicio' && <>
          <div className="eyebrow"><span/> PLATAFORMA DE VISÃO COMPUTACIONAL</div>
          <div className="hero-row"><div><h1>Inteligência que<br/><em>cresce no campo.</em></h1><p className="hero-copy">Três modelos especializados para transformar imagens agrícolas em informação de decisão.</p></div><div className="hero-note"><div className="note-icon"><ShieldCheck size={19}/></div><p>Métricas apresentadas refletem testes controlados e não garantem desempenho em campo.</p><ArrowDown size={16}/></div></div>
          <div className="section-heading"><div><span className="eyebrow-small">FERRAMENTAS DE ANÁLISE</span><h2>Escolha seu modelo</h2></div><button className="text-button" onClick={() => setSection('analise')}>Todas as análises <ArrowRight size={15}/></button></div>
          <div className="module-grid">{modules.map((item, index) => { const Icon = item.icon; const status = statuses.find(s => s.id === item.id); return <button className="module-card" key={item.id} onClick={() => { setModel(item.id); setSection('analise'); setResults([]) }}><div className="module-top"><span className={`module-icon ${item.tint}`}><Icon size={21}/></span><span className="model-state"><i className={status?.state === 'ready' ? 'state-dot ready' : 'state-dot'}/>{status?.state === 'ready' ? 'Disponível' : 'Aguardando pesos'}</span></div><span className="module-index">0{index + 1} / MODELO</span><h3>{item.title}</h3><p>{item.subtitle}</p><div className="module-bottom"><span>{item.metric}</span><span className="circle-arrow"><ArrowRight size={16}/></span></div></button> })}</div>
          <div className="overview-lower"><div className="metrics-panel"><div className="panel-title"><div><span className="eyebrow-small">VISÃO DO SISTEMA</span><h2>Modelos em operação</h2></div><span className="updated"><span/> {statuses.length ? 'Conectado à API' : 'API desconectada'}</span></div><div className="model-rows">{modules.map(m => { const s = statuses.find(x => x.id === m.id); return <div className="model-row" key={m.id}><span className="row-icon"><m.icon size={17}/></span><div className="row-name"><strong>{m.title}</strong><small>{s?.detail || 'Conecte a API local para consultar o estado do checkpoint.'}</small></div><span className={s?.state === 'ready' ? 'badge-ready' : 'badge-off'}><i/> {s?.state === 'ready' ? 'Pronto' : s?.state === 'error' ? 'Erro' : 'Indisponível'}</span></div> })}</div></div>
            <div className="field-note"><div className="field-note-top"><span className="note-icon"><Leaf size={17}/></span><span>PRECISÃO COM CONTEXTO</span></div><h3>Dados de teste.<br/>Decisões conscientes.</h3><p>Os indicadores dos modelos foram medidos em conjuntos de teste. Condições de campo podem produzir resultados diferentes.</p><button onClick={() => setSection('historico')}>Ver análises recentes <ArrowRight size={14}/></button></div></div>
          <footer className="footer"><span>SoJão · Inteligência Agrícola</span><span>Inferência local · Seus arquivos permanecem no dispositivo</span></footer>
        </>}
        {section === 'analise' && <>
          <div className="eyebrow"><span/> CENTRAL DE ANÁLISE</div><h1 className="page-title">Nova análise</h1><p className="page-subtitle">Selecione o modelo e envie imagens para inferência no backend local.</p>
          <div className="analysis-layout"><div className="analysis-main"><div className="form-section"><div className="form-label"><span>01</span><div><strong>Modelo de análise</strong><small>Escolha a tarefa para suas imagens</small></div></div><div className="selector-grid">{modules.map(m => { const Icon = m.icon; return <button key={m.id} onClick={() => { setModel(m.id); setResults([]) }} className={model === m.id ? 'selector-card selected' : 'selector-card'}><Icon size={18}/><span>{m.title}</span>{model === m.id && <Check size={15}/>}</button> })}</div>{model === 'daninhas' && <p className="inline-notice">Este modelo classifica recortes individuais. Não segmenta nem detecta plantas daninhas em fotografias inteiras.</p>}</div>
          {model === 'insetos' && <div className="form-section tune-section"><div className="form-label"><span>02</span><div><strong>Parâmetros do detector</strong><small>Ajuste os limites de inferência</small></div></div><label className="range-row">Confiança mínima <strong>{(confidence / 100).toFixed(2)}</strong><input aria-label="Limite de confiança" type="range" min="5" max="95" value={confidence} onChange={e => setConfidence(Number(e.target.value))}/></label><label className="range-row">IoU <strong>{(iou / 100).toFixed(2)}</strong><input aria-label="Limite IoU" type="range" min="5" max="95" value={iou} onChange={e => setIou(Number(e.target.value))}/></label></div>}
          <div className="form-section"><div className="form-label"><span>{model === 'insetos' ? '03' : '02'}</span><div><strong>Imagens para análise</strong><small>JPG, PNG, WEBP, BMP ou TIFF · até 20 MB cada</small></div></div><div className="dropzone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}><div className="upload-icon"><CloudUpload size={23}/></div><strong>Arraste imagens ou <em>procure no dispositivo</em></strong><span>Selecione uma ou várias imagens de uma vez</span><input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.bmp,.tif,.tiff,image/*" multiple hidden onChange={e => addFiles(e.target.files)}/></div>
          {files.length > 0 && <div className="file-list">{files.map((f, i) => <div className="file-item" key={`${f.name}-${i}`}><img src={URL.createObjectURL(f)} alt={`Pré-visualização de ${f.name}`}/><span><strong>{f.name}</strong><small>{(f.size / 1024 / 1024).toFixed(1)} MB</small></span><button aria-label={`Remover ${f.name}`} onClick={() => setFiles(prev => prev.filter((_, n) => n !== i))}><X size={15}/></button></div>)}</div>}
          {error && <div className="error-message" role="alert">{error}</div>}<button className="primary-button" disabled={busy || !files.length || chosenStatus?.state !== 'ready'} onClick={analyze}>{busy ? <><LoaderCircle className="spin" size={16}/> Analisando imagens…</> : <>Executar análise <ArrowRight size={16}/></>}</button>{chosenStatus?.state !== 'ready' && <p className="availability-note">A análise será habilitada após a API confirmar o carregamento e a validação do checkpoint original.</p>}</div>
          </div>
          <aside className="analysis-aside"><span className="eyebrow-small">SOBRE O MODELO</span><h3>{modules.find(m => m.id === model)?.title}</h3><p>{model === 'folhas' ? 'Classificador ResNet18 treinado para reconhecer sinais foliares em folhas de soja.' : model === 'insetos' ? 'Detector YOLO26n com caixas, classes e confiança por objeto encontrado.' : 'Classificador ResNet18 para recortes de vegetação. Não realiza segmentação semântica.'}</p><div className="aside-divider"/><span className="eyebrow-small">CLASSES RECONHECIDAS</span><div className="class-list">{(chosenStatus?.classes || (model === 'folhas' ? ['saudavel','lagarta','vaquinha'] : model === 'daninhas' ? ['broadleaf','grass','soil','soybean'] : [])).map(c => <span key={c}>{c.replaceAll('_',' ')}</span>)}</div><div className="aside-callout"><ShieldCheck size={16}/><span>As imagens são processadas localmente. O sistema não armazena os arquivos originais enviados.</span></div></aside></div>
          {results.length > 0 && <div className="results-section"><div className="section-heading"><div><span className="eyebrow-small">INFERÊNCIA CONCLUÍDA</span><h2>Resultados por imagem</h2></div><span className="result-count">{results.length} arquivos</span></div><div className="results-grid">{results.map(r => <ResultCard key={r.id} result={r} model={model} api={API}/>)}</div></div>}
          <footer className="footer"><span>SoJão · Inteligência Agrícola</span><span>Resultados são apoio à análise, não diagnóstico agronômico.</span></footer>
        </>}
        {section === 'historico' && <><div className="eyebrow"><span/> REGISTRO DE INFERÊNCIAS</div><h1 className="page-title">Histórico</h1><p className="page-subtitle">Consulte as análises concluídas e seus resultados individuais.</p><div className="history-toolbar"><div className="search-box"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar por nome de arquivo" aria-label="Pesquisar histórico"/></div><div className="history-filter-group"><label className="sr-only" htmlFor="history-model">Filtrar por modelo</label><select id="history-model" className="filter-button history-filter-control" value={historyModel} onChange={e => setHistoryModel(e.target.value)}><option value="">Todos os modelos</option>{modules.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><label className="sr-only" htmlFor="history-from">Data inicial</label><input id="history-from" className="filter-button history-filter-control" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/><label className="sr-only" htmlFor="history-to">Data final</label><input id="history-to" className="filter-button history-filter-control" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}/></div></div>{filteredHistory.length ? <div className="history-table"><div className="history-head"><span>ARQUIVO</span><span>MODELO</span><span>RESULTADO</span><span>CONFIANÇA</span><span>DATA</span></div>{filteredHistory.map(item => <div className="history-row" key={item.id}><span className="history-file"><FileImage size={16}/>{item.filename}</span><span>{labels[item.model] || item.model}</span><strong>{item.result}</strong><span>{item.confidence == null ? '—' : `${(item.confidence * 100).toFixed(1)}%`}</span><span>{new Date(item.created_at).toLocaleDateString('pt-BR')}</span></div>)}</div> : <div className="history-empty"><Clock3 size={24}/><strong>{historyError || statusError ? 'API local não conectada' : query || historyModel || dateFrom || dateTo ? 'Nenhum resultado para esses filtros' : 'Nenhuma análise registrada'}</strong><p>{historyError || statusError ? 'Inicie o backend local para consultar ou salvar análises.' : 'Os resultados de inferências concluídas aparecerão aqui.'}</p>{!(historyError || statusError) && <button className="text-button" onClick={() => setSection('analise')}>Iniciar uma análise <ArrowRight size={15}/></button>}</div>}<footer className="footer"><span>SoJão · Inteligência Agrícola</span><span>Histórico de resultados · armazenamento SQLite local</span></footer></>}
      </div>
    </section>
  </main>
}

function ResultCard({ result, model, api }: { result: Result; model: string; api: string }) {
  const probabilities = result.probabilities || result.payload?.probabilities || {}
  const detections = result.detections || result.payload?.detections || []
  const annotated = result.annotated_url || result.payload?.annotated_url
  return <article className="result-card">{model === 'insetos' ? <div className="detection-images"><figure><img src={result.original_image} alt={`Imagem original ${result.filename}`}/><figcaption>Original</figcaption></figure>{annotated && <figure><img src={`${api}${annotated}`} alt={`Imagem anotada ${result.filename}`}/><figcaption>Detecções</figcaption></figure>}</div> : <div className="result-image"><FileImage size={21}/><span>{result.filename}</span></div>}<div className="result-body"><span className="eyebrow-small">{labels[model]}</span><h3>{result.result}</h3>{result.confidence != null && <div className="confidence-line">Confiança <strong>{(result.confidence * 100).toFixed(1)}%</strong></div>}{Object.keys(probabilities).length > 0 && <div className="probability-list">{Object.entries(probabilities).map(([label, value]) => <div key={label}><span>{label}</span><strong>{(Number(value) * 100).toFixed(1)}%</strong><i><b style={{ width: `${Number(value) * 100}%` }}/></i></div>)}</div>}{model === 'insetos' && <div className="detections-list"><strong>{detections.length} objeto(s) detectado(s)</strong>{detections.map((d: any, i: number) => <span key={i}>{d.class} · {(d.confidence * 100).toFixed(1)}% · [{d.xyxy.map((n: number) => Math.round(n)).join(', ')}]</span>)}</div>}</div></article>
}

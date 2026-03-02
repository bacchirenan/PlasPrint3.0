// Tipos compartilhados com PlasPrint Manutenção
export type UserRole = 'user' | 'master' | 'admin'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

// ─── Tipos de Dados dos Arquivos (GitHub) ─────────────────────────────────────

export interface ProducaoRow {
  maquina: string
  data: string
  hora: number
  turno: string
  registro: string
  os: string
  produto: string
  operador: string
  tempo_segundos: number
  producao_total: number
  rejeito: number
  pecas_boas: number
}

export interface OeeRow {
  maquina: string
  data: string
  turno: string
  hora: number
  disponibilidade: number
  performance: number
  qualidade: number
  teep: number
  oee: number
  is_parada_prevista?: boolean
}

export interface FichaTecnica {
  id: number
  referencia: string
  produto: string
  decoracao: string
  data_cadastro: string
  tempo_s: number
  cyan: number
  magenta: number
  yellow: number
  black: number
  white: number
  varnish: number
  largura: number
  altura: number
  diametro: number
  print_edge: number
  powergrade: number
  finish_time: number
  intervalo: number
  uv_lamp: number
  obs: string | null
  image_path: string | null
  config_cyan: string
  config_magenta: string
  config_yellow: string
  config_black: string
  config_white: string
  config_varnish: string
  // Calculados
  custo_tinta_total?: number
  custo_por_unidade?: number
}

export interface CanudoRow {
  data: string
  turno: string
  os: string
  operador: string
  operador_nome: string
  pecas_boas: number
  perdas: number
  hora: number
}

// ─── Tipos de Configuração (Supabase) ─────────────────────────────────────────

export interface InkCost {
  cor: string
  preco_litro_usd: number
  preco_litro_brl: number
  updated_at: string
}

export interface AppConfig {
  chave: string
  valor: number
}

// ─── Tipos de Gráficos ────────────────────────────────────────────────────────

export interface ChartDataPoint {
  x: string | number
  y: number
  label?: string
  color?: string
}

export const CORES_TINTA = ['cyan', 'magenta', 'yellow', 'black', 'white', 'varnish'] as const
export type CorTinta = typeof CORES_TINTA[number]

export const COR_LABELS: Record<CorTinta, string> = {
  cyan: 'Ciano',
  magenta: 'Magenta',
  yellow: 'Amarelo',
  black: 'Preto',
  white: 'Branco',
  varnish: 'Verniz',
}

export const MACHINE_ORDER = ['28', '29', '180', '181', '182']
export const MACHINE_FULL_NAMES: Record<string, string> = {
  '28': '28-CX-360G',
  '29': '29-CX-360G',
  '180': '180- CX-360G',
  '181': '181- CX-360G',
  '182': '182- CX-360G',
}

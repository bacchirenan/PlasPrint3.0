
-- ============================================================
-- TABELA: ordens_programadas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ordens_programadas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    os TEXT NOT NULL,
    produto TEXT NOT NULL,
    ciclo NUMERIC DEFAULT 0, -- Peças/Hora ou Ciclo (Segundos)
    ciclos_planejados INTEGER DEFAULT 0,
    ciclos_realizados INTEGER DEFAULT 0,
    maquina_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.ordens_programadas ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
DROP POLICY IF EXISTS "Ver ordens programadas" ON public.ordens_programadas;
CREATE POLICY "Ver ordens programadas" ON public.ordens_programadas
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Inserir ordens programadas" ON public.ordens_programadas;
CREATE POLICY "Inserir ordens programadas" ON public.ordens_programadas
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Atualizar ordens programadas" ON public.ordens_programadas;
CREATE POLICY "Atualizar ordens programadas" ON public.ordens_programadas
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Deletar ordens programadas" ON public.ordens_programadas;
CREATE POLICY "Deletar ordens programadas" ON public.ordens_programadas
    FOR DELETE TO authenticated USING (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordens_programadas;

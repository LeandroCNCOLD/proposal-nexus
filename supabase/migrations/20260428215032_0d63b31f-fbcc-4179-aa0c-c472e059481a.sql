CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.role_module_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role public.app_role NOT NULL,
  module_key text NOT NULL,
  module_path text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (role, module_key)
);

ALTER TABLE public.role_module_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view module access"
ON public.role_module_access
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can create module access"
ON public.role_module_access
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'diretoria')
  OR public.has_role(auth.uid(), 'gerente_comercial')
);

CREATE POLICY "Managers can update module access"
ON public.role_module_access
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'diretoria')
  OR public.has_role(auth.uid(), 'gerente_comercial')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'diretoria')
  OR public.has_role(auth.uid(), 'gerente_comercial')
);

CREATE TRIGGER update_role_module_access_updated_at
BEFORE UPDATE ON public.role_module_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.role_module_access (role, module_key, module_path, allowed)
SELECT role::public.app_role, module_key, module_path, allowed
FROM (VALUES
('admin','dashboard','/app',true),('admin','crm','/app/crm',true),('admin','propostas','/app/propostas',true),('admin','pedidos','/app/propostas/pedidos-nf',true),('admin','tarefas','/app/tarefas',true),('admin','clientes','/app/clientes',true),('admin','concorrentes','/app/concorrentes',true),('admin','equipamentos','/app/equipamentos',true),('admin','coldpro','/app/coldpro',true),('admin','produtos','/app/coldpro/produtos',true),('admin','catalogo','/app/coldpro/catalogo',true),('admin','competitiva','/app/competitiva',true),('admin','documentos','/app/documentos',true),('admin','relatorios','/app/relatorios',true),('admin','aprovacoes','/app/aprovacoes',true),('admin','templates','/app/configuracoes/templates',true),('admin','nomus','/app/configuracoes/nomus',true),('admin','api_nomus','/app/configuracoes/api-nomus',true),('admin','configuracoes','/app/configuracoes',true),
('diretoria','dashboard','/app',true),('diretoria','crm','/app/crm',true),('diretoria','propostas','/app/propostas',true),('diretoria','pedidos','/app/propostas/pedidos-nf',true),('diretoria','tarefas','/app/tarefas',true),('diretoria','clientes','/app/clientes',true),('diretoria','concorrentes','/app/concorrentes',true),('diretoria','equipamentos','/app/equipamentos',true),('diretoria','coldpro','/app/coldpro',true),('diretoria','produtos','/app/coldpro/produtos',true),('diretoria','catalogo','/app/coldpro/catalogo',true),('diretoria','competitiva','/app/competitiva',true),('diretoria','documentos','/app/documentos',true),('diretoria','relatorios','/app/relatorios',true),('diretoria','aprovacoes','/app/aprovacoes',true),('diretoria','templates','/app/configuracoes/templates',true),('diretoria','nomus','/app/configuracoes/nomus',true),('diretoria','api_nomus','/app/configuracoes/api-nomus',true),('diretoria','configuracoes','/app/configuracoes',true),
('gerente_comercial','dashboard','/app',true),('gerente_comercial','crm','/app/crm',true),('gerente_comercial','propostas','/app/propostas',true),('gerente_comercial','pedidos','/app/propostas/pedidos-nf',true),('gerente_comercial','tarefas','/app/tarefas',true),('gerente_comercial','clientes','/app/clientes',true),('gerente_comercial','concorrentes','/app/concorrentes',true),('gerente_comercial','equipamentos','/app/equipamentos',false),('gerente_comercial','coldpro','/app/coldpro',false),('gerente_comercial','produtos','/app/coldpro/produtos',false),('gerente_comercial','catalogo','/app/coldpro/catalogo',false),('gerente_comercial','competitiva','/app/competitiva',true),('gerente_comercial','documentos','/app/documentos',true),('gerente_comercial','relatorios','/app/relatorios',true),('gerente_comercial','aprovacoes','/app/aprovacoes',true),('gerente_comercial','templates','/app/configuracoes/templates',false),('gerente_comercial','nomus','/app/configuracoes/nomus',false),('gerente_comercial','api_nomus','/app/configuracoes/api-nomus',false),('gerente_comercial','configuracoes','/app/configuracoes',true),
('engenharia','dashboard','/app',true),('engenharia','crm','/app/crm',false),('engenharia','propostas','/app/propostas',true),('engenharia','pedidos','/app/propostas/pedidos-nf',false),('engenharia','tarefas','/app/tarefas',false),('engenharia','clientes','/app/clientes',false),('engenharia','concorrentes','/app/concorrentes',false),('engenharia','equipamentos','/app/equipamentos',true),('engenharia','coldpro','/app/coldpro',true),('engenharia','produtos','/app/coldpro/produtos',true),('engenharia','catalogo','/app/coldpro/catalogo',true),('engenharia','competitiva','/app/competitiva',false),('engenharia','documentos','/app/documentos',true),('engenharia','relatorios','/app/relatorios',false),('engenharia','aprovacoes','/app/aprovacoes',false),('engenharia','templates','/app/configuracoes/templates',false),('engenharia','nomus','/app/configuracoes/nomus',false),('engenharia','api_nomus','/app/configuracoes/api-nomus',false),('engenharia','configuracoes','/app/configuracoes',true),
('orcamentista','dashboard','/app',true),('orcamentista','crm','/app/crm',false),('orcamentista','propostas','/app/propostas',true),('orcamentista','pedidos','/app/propostas/pedidos-nf',false),('orcamentista','tarefas','/app/tarefas',false),('orcamentista','clientes','/app/clientes',false),('orcamentista','concorrentes','/app/concorrentes',false),('orcamentista','equipamentos','/app/equipamentos',true),('orcamentista','coldpro','/app/coldpro',true),('orcamentista','produtos','/app/coldpro/produtos',true),('orcamentista','catalogo','/app/coldpro/catalogo',true),('orcamentista','competitiva','/app/competitiva',false),('orcamentista','documentos','/app/documentos',true),('orcamentista','relatorios','/app/relatorios',false),('orcamentista','aprovacoes','/app/aprovacoes',false),('orcamentista','templates','/app/configuracoes/templates',false),('orcamentista','nomus','/app/configuracoes/nomus',false),('orcamentista','api_nomus','/app/configuracoes/api-nomus',false),('orcamentista','configuracoes','/app/configuracoes',true),
('administrativo','dashboard','/app',true),('administrativo','crm','/app/crm',false),('administrativo','propostas','/app/propostas',false),('administrativo','pedidos','/app/propostas/pedidos-nf',true),('administrativo','tarefas','/app/tarefas',false),('administrativo','clientes','/app/clientes',true),('administrativo','concorrentes','/app/concorrentes',false),('administrativo','equipamentos','/app/equipamentos',false),('administrativo','coldpro','/app/coldpro',false),('administrativo','produtos','/app/coldpro/produtos',false),('administrativo','catalogo','/app/coldpro/catalogo',false),('administrativo','competitiva','/app/competitiva',false),('administrativo','documentos','/app/documentos',true),('administrativo','relatorios','/app/relatorios',true),('administrativo','aprovacoes','/app/aprovacoes',false),('administrativo','templates','/app/configuracoes/templates',false),('administrativo','nomus','/app/configuracoes/nomus',false),('administrativo','api_nomus','/app/configuracoes/api-nomus',false),('administrativo','configuracoes','/app/configuracoes',true),
('vendedor','dashboard','/app',true),('vendedor','crm','/app/crm',true),('vendedor','propostas','/app/propostas',true),('vendedor','pedidos','/app/propostas/pedidos-nf',false),('vendedor','tarefas','/app/tarefas',true),('vendedor','clientes','/app/clientes',true),('vendedor','concorrentes','/app/concorrentes',true),('vendedor','equipamentos','/app/equipamentos',false),('vendedor','coldpro','/app/coldpro',false),('vendedor','produtos','/app/coldpro/produtos',false),('vendedor','catalogo','/app/coldpro/catalogo',false),('vendedor','competitiva','/app/competitiva',false),('vendedor','documentos','/app/documentos',true),('vendedor','relatorios','/app/relatorios',false),('vendedor','aprovacoes','/app/aprovacoes',false),('vendedor','templates','/app/configuracoes/templates',false),('vendedor','nomus','/app/configuracoes/nomus',false),('vendedor','api_nomus','/app/configuracoes/api-nomus',false),('vendedor','configuracoes','/app/configuracoes',true),
('coldpro','dashboard','/app',false),('coldpro','crm','/app/crm',false),('coldpro','propostas','/app/propostas',false),('coldpro','pedidos','/app/propostas/pedidos-nf',false),('coldpro','tarefas','/app/tarefas',false),('coldpro','clientes','/app/clientes',false),('coldpro','concorrentes','/app/concorrentes',false),('coldpro','equipamentos','/app/equipamentos',false),('coldpro','coldpro','/app/coldpro',true),('coldpro','produtos','/app/coldpro/produtos',true),('coldpro','catalogo','/app/coldpro/catalogo',true),('coldpro','competitiva','/app/competitiva',false),('coldpro','documentos','/app/documentos',false),('coldpro','relatorios','/app/relatorios',false),('coldpro','aprovacoes','/app/aprovacoes',false),('coldpro','templates','/app/configuracoes/templates',false),('coldpro','nomus','/app/configuracoes/nomus',false),('coldpro','api_nomus','/app/configuracoes/api-nomus',false),('coldpro','configuracoes','/app/configuracoes',true)
) AS seed(role, module_key, module_path, allowed);
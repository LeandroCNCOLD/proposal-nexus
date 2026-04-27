
-- Substitui a policy de SELECT pública por uma que só permite SELECT autenticado para listing,
-- mas mantém o bucket público para downloads diretos via URL.
DROP POLICY IF EXISTS "template_assets_public_read" ON storage.objects;

CREATE POLICY "template_assets_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'proposal-template-assets');

-- O bucket continua public=true, então URLs públicas funcionam para servir o conteúdo
-- sem precisar de policy SELECT para anon.

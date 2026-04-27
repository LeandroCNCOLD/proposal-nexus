INSERT INTO storage.buckets (id, name, public)
VALUES ('coldpro-equipment-images', 'coldpro-equipment-images', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.coldpro_equipment_models
ADD COLUMN IF NOT EXISTS plugin_image_path text,
ADD COLUMN IF NOT EXISTS split_image_path text,
ADD COLUMN IF NOT EXISTS biblock_image_path text;

CREATE POLICY "ColdPro equipment images are viewable by authenticated users"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'coldpro-equipment-images');

CREATE POLICY "Engineering can upload ColdPro equipment images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'coldpro-equipment-images'
  AND public.has_any_role(auth.uid(), ARRAY['engenharia'::public.app_role, 'diretoria'::public.app_role, 'admin'::public.app_role])
);

CREATE POLICY "Engineering can update ColdPro equipment images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'coldpro-equipment-images'
  AND public.has_any_role(auth.uid(), ARRAY['engenharia'::public.app_role, 'diretoria'::public.app_role, 'admin'::public.app_role])
)
WITH CHECK (
  bucket_id = 'coldpro-equipment-images'
  AND public.has_any_role(auth.uid(), ARRAY['engenharia'::public.app_role, 'diretoria'::public.app_role, 'admin'::public.app_role])
);

CREATE POLICY "Engineering can delete ColdPro equipment images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'coldpro-equipment-images'
  AND public.has_any_role(auth.uid(), ARRAY['engenharia'::public.app_role, 'diretoria'::public.app_role, 'admin'::public.app_role])
);
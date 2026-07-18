-- Canal de adquisición para prospectos traídos por apollo-import-list, para que
-- se muestren con una etiqueta legible en vez del slug crudo en el pipeline.
INSERT INTO public.crm_acquisition_channels (slug, label, color)
VALUES ('apollo_import', 'Apollo (importación masiva)', '#9333ea')
ON CONFLICT (slug) DO NOTHING;

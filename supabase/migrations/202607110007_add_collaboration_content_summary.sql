alter table if exists public.artist_collaborations
add column if not exists content_summary text not null default '';

comment on column public.artist_collaborations.content_summary is
  'Internal summary of the collaboration content. Never exposed through public artist DTOs.';

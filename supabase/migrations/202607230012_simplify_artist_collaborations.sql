alter table public.artist_collaborations
  add column if not exists brand_industry text not null default '',
  add column if not exists collaboration_date text not null default '';

update public.artist_collaborations as collaboration
set brand_industry = coalesce(category.name, '')
from public.brand_categories as category
where collaboration.brand_category_id = category.id
  and btrim(collaboration.brand_industry) = '';

update public.artist_collaborations
set collaboration_date =
  right(collaboration_year::text, 2)
  || case
    when collaboration_month is null then ''
    else '.' || lpad(collaboration_month::text, 2, '0')
  end
where btrim(collaboration_date) = '';

comment on column public.artist_collaborations.brand_industry is
  'Admin-entered brand industry text. Replaces brand_category_id for collaboration history entry.';

comment on column public.artist_collaborations.collaboration_date is
  'Admin-entered collaboration date label, normally YY.MM.DD. Legacy year/month rows are backfilled as YY or YY.MM.';

comment on column public.artist_collaborations.brand_category_id is
  'Deprecated compatibility column. New collaboration history uses brand_industry.';

comment on column public.artist_collaborations.collaboration_year is
  'Legacy compatibility column derived from collaboration_date for existing queries.';

comment on column public.artist_collaborations.collaboration_month is
  'Legacy compatibility column derived from collaboration_date for existing queries.';

comment on column public.artist_collaborations.ad_disclosure_status is
  'Deprecated compatibility column. Advertising disclosure is treated as mandatory and is no longer entered in Admin.';

comment on column public.artist_collaborations.views is
  'Deprecated compatibility column. View counts are no longer collected in Admin.';

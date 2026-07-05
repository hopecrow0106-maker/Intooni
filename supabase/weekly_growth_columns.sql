alter table public.artists
add column if not exists weekly_follower_growth integer not null default 0;

alter table public.artists
add column if not exists weekly_post_growth integer not null default 0;

alter table public.artists
add column if not exists weekly_follower_growth_rate numeric not null default 0;

alter table public.artists
add column if not exists weekly_post_growth_rate numeric not null default 0;

alter table public.artists
add column if not exists stats_period_start date;

alter table public.artists
add column if not exists stats_period_end date;

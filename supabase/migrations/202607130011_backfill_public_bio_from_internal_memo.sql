-- Copy the existing operating-note text into the public artist profile field.
-- Do not overwrite a profile that has already been entered explicitly.
update public.artists
set
  bio = internal_memo,
  updated_at = now()
where coalesce(btrim(bio), '') = ''
  and coalesce(btrim(internal_memo), '') <> '';

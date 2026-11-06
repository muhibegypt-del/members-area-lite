alter table public.sittings alter column recorded_on drop not null;
alter table public.sittings add column position integer not null default 0;

alter table public.resources add constraint resources_text_url_key unique (text_id, url);

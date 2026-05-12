-- Run this once in the Supabase SQL Editor to enable the notifications feature.

create table if not exists notifications (
  id          uuid        default gen_random_uuid() primary key,
  type        text        not null,             -- 'new_order', 'low_stock', etc.
  title       text        not null,
  body        text,
  payload     jsonb       default '{}'::jsonb,
  is_read     boolean     default false,
  created_at  timestamptz default now()
);

-- Efficient queries: recent unread, paginated list
create index if not exists notifications_created_at_idx on notifications (created_at desc);
create index if not exists notifications_unread_idx     on notifications (is_read) where is_read = false;

-- Optional: auto-purge notifications older than 30 days.
-- Uncomment if you want to keep the table lean.
-- create or replace function prune_old_notifications() returns void language sql as $$
--   delete from notifications where created_at < now() - interval '30 days';
-- $$;

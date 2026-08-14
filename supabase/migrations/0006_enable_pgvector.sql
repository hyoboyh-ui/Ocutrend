-- Stage 2 personalization prep: pgvector + storage for favorite embeddings.
--
-- Only favorites are persisted as vectors. Weekly candidates are embedded fresh each
-- run and compared in application code against a category's stored favorite vectors
-- (see embeddings.ts / stage 2 batch step, added separately) — with typically a
-- couple dozen favorites per category, there is no dataset large enough to justify an
-- ANN index, so `vector` is left without a fixed dimension or ivfflat/hnsw index.
create extension if not exists vector;

create table favorite_embeddings (
  favorite_id   uuid primary key references favorites(id) on delete cascade,
  embedding     vector not null,
  model         text not null,
  created_at    timestamptz not null default now()
);

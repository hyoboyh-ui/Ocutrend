/**
 * Shown instantly on every in-app navigation.
 *
 * Every page in this group is `force-dynamic` and waits on Supabase, so without a
 * loading boundary the browser sat on the OLD page showing nothing until the RSC
 * response arrived — the main source of the app feeling sluggish. This boundary
 * also makes `<Link>` prefetch useful: Next can prefetch and render this shell
 * immediately, then stream the real content in.
 */
export default function Loading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="読み込み中">
      <div className="h-4 w-32 animate-pulse rounded bg-bg-surface-raised" />
      <div className="h-28 animate-pulse rounded-2xl bg-bg-surface-raised" />
      <div className="h-20 animate-pulse rounded-2xl bg-bg-surface-raised" />
      <div className="h-20 animate-pulse rounded-2xl bg-bg-surface-raised" />
    </div>
  );
}

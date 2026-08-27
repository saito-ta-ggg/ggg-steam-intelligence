import { PageControls } from '@/components/PageControls';
import { EmptyState } from '@/components/EmptyState';
import { loadPageContext } from '@/lib/pageContext';
import type { SearchParams } from '@/lib/params';

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await loadPageContext(params, searchParams, 'reviews');

  return (
    <>
      <PageControls context={context} />
      <section>
        <EmptyState
          title="Reviews data is not yet connected"
          description="Review ingestion does not exist yet, so this tab is a data-ready placeholder. No review count, score or sentiment is shown, because a fabricated value here would be indistinguishable from a real one."
          requirements={[
            'docs/DATA_MODEL.md — provisional tables steam_reviews (one row per recommendation) and steam_review_daily_snapshot (AppID x date summary)',
            'docs/OPEN_QUESTIONS.md #5 — reviews ingestion completion and final table names',
            'Once connected, this tab reuses the same product selector, date range and scope controls as the rest of the app.',
          ]}
        />
      </section>
    </>
  );
}

import { PageControls } from '@/components/PageControls';
import { EmptyState } from '@/components/EmptyState';
import { loadPageContext } from '@/lib/pageContext';
import type { SearchParams } from '@/lib/params';

export default async function UpdatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await loadPageContext(params, searchParams, 'updates');

  return (
    <>
      <PageControls context={context} />
      <section>
        <EmptyState
          title="Updates and events data is not yet connected"
          description="There is no canonical event dataset yet, so patch notes, news and event markers are not shown. The Overview and Pricing tabs surface price-derived Detected discounted periods only, which is the one event-like signal the warehouse can support today."
          requirements={[
            'docs/DATA_MODEL.md — provisional table steam_events (event_id, appid, event_type, start_at, end_at, name, source, metadata_json)',
            'docs/OPEN_QUESTIONS.md #4 — canonical sale/event dataset and naming',
            'docs/OPEN_QUESTIONS.md #7 — external bundle/event normalisation (e.g. Fanatical)',
          ]}
        />
      </section>
    </>
  );
}

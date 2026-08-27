import { PageControls } from '@/components/PageControls';
import { TimelineLegend } from '@/components/TimelineLegend';
import { UnifiedTimelineChart } from '@/components/UnifiedTimelineChart';
import { buildUnifiedTimeline, parseEnabledTimelineLayers, type TimelineLayerId } from '@/domain/timeline';
import { loadPageContext } from '@/lib/pageContext';
import { buildHref, first, type SearchParams } from '@/lib/params';

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await loadPageContext(params, searchParams, 'timeline');
  const enabledLayerIds = parseEnabledTimelineLayers(first(context.searchParams.layers));

  const [daily, pricing] = await Promise.all([
    context.repository.getDailySales(context.scope, context.range),
    context.repository.getPricingTimeline(context.scope, context.range),
  ]);

  const timeline = buildUnifiedTimeline({
    range: context.range,
    source: context.repository.source,
    daily,
    pricing,
  });

  const buildLayersHref = (next: readonly TimelineLayerId[]) =>
    buildHref(context.pathname, context.searchParams, { layers: next.length === 0 ? 'none' : next.join(',') });

  return (
    <>
      <PageControls context={context} aggregation="fine-grain" />

      <div className="notice">
        Phase 2A visualization foundation. Only <strong>Gross Sales</strong>, <strong>Net Units</strong>,{' '}
        <strong>Return Rate</strong> and <strong>Price / observed effective discount</strong> are real data from this
        repository ({context.repository.source === 'mock' ? 'mock fixtures' : 'BigQuery'}). CCU, Reviews and
        Updates/events have no connected source yet and always render as an explicit &quot;Not connected&quot;
        placeholder — never a fabricated or mocked-as-real value. See{' '}
        <code>docs/PHASE_2A_TIMELINE.md</code> for what is implemented vs. not connected.
      </div>

      <section>
        <div className="section-head">
          <h2>Combined timeline</h2>
          <span className="section-note">
            One row per selected layer, sharing the same date axis. Toggle layers below — this is the same contract
            (<code>src/domain/timeline.ts</code>) later Review API, Store API, CCU and event data will plug into.
          </span>
        </div>
        <div className="panel panel-pad">
          <UnifiedTimelineChart timeline={timeline} enabledLayerIds={enabledLayerIds} />
        </div>
        <div style={{ marginTop: 10 }}>
          <TimelineLegend
            timeline={timeline}
            enabledLayerIds={enabledLayerIds}
            pathname={context.pathname}
            buildLayersHref={buildLayersHref}
          />
        </div>
        <p className="footnote">
          Exact values for these same metrics remain available as tables/KPI cards on the Overview, Sales and Pricing
          &amp; Sales tabs; this timeline is a visual complement, not a replacement for those figures.
        </p>
      </section>
    </>
  );
}

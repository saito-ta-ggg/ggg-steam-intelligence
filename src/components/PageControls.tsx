import { PRODUCT_CATALOG } from '@/domain/scope';
import { Controls } from './Controls';
import { ScopeBanner } from './ScopeBanner';
import type { PageContext } from '@/lib/pageContext';
import type { MonetaryAggregation } from '@/domain/types';

/** Global shell controls plus the mandatory scope/range indicator. */
export function PageControls({
  context,
  aggregation,
}: {
  readonly context: PageContext;
  readonly aggregation?: MonetaryAggregation;
}) {
  return (
    <>
      <Controls
        products={PRODUCT_CATALOG}
        appId={context.product.appId}
        range={context.range}
        bounds={context.bounds}
        scopeKind={context.scopeKind}
        activePreset={context.preset}
      />
      <ScopeBanner
        scope={context.scope}
        range={context.range}
        freshness={context.freshness}
        aggregation={aggregation}
      />
    </>
  );
}

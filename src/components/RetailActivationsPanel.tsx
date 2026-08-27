import { InfoTip } from './InfoTip';
import { formatUnits } from '@/domain/format';
import type { RetailActivationRow } from '@/domain/types';

/**
 * Retail / CD-key activations.
 *
 * METRICS.md: retail activation is not Store revenue. UI_SPEC.md: Retail
 * activation and Store sales are never mixed without labels. This panel is
 * therefore visually and structurally separate from every monetary table, it
 * carries unit counts only, and it has no monetary column at all — there is no
 * figure here that could be added to a sales total by mistake.
 */
export function RetailActivationsPanel({ rows }: { readonly rows: readonly RetailActivationRow[] }) {
  const total = rows.reduce((accumulator, row) => accumulator + row.unitsActivated, 0);

  return (
    <section>
      <div className="section-head">
        <h2>
          Retail / CD-key activations <InfoTip definition="activations" />
        </h2>
        <span className="badge badge-retail">Not Steam Store revenue</span>
      </div>
      <div className="notice">
        Activation counts only. These rows are <strong>not</strong> sales and carry no revenue, so they are excluded
        from every monetary figure elsewhere in this app and must never be added to Gross Sales, Net Steam Sales or
        Revenue Share.
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th className="num">Package ID</th>
              <th>Territory</th>
              <th className="num">Units activated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.packageId}-${row.territory ?? 'none'}`}>
                <td className="row-name">{row.packageName}</td>
                <td className="num">{row.packageId}</td>
                <td>{row.territory ?? 'No data'}</td>
                <td className="num">{formatUnits(row.unitsActivated)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4}>No retail activations in the selected range and scope.</td>
              </tr>
            ) : null}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr>
                <td colSpan={3}>Total units activated</td>
                <td className="num">{formatUnits(total)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

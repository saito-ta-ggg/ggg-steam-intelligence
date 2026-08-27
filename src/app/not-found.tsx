import Link from 'next/link';
import { PRODUCT_CATALOG } from '@/domain/scope';

export default function NotFound() {
  return (
    <main className="shell" style={{ paddingTop: 48 }}>
      <div className="empty">
        <h3>Not found</h3>
        <p>
          That product or page is not in the catalogue. Products are registered in
          <code> src/domain/scope.ts</code> together with their base Package family, because a base-product
          total can never be derived from <code>primary_appid</code> alone.
        </p>
        <ul>
          {PRODUCT_CATALOG.map((product) => (
            <li key={product.appId}>
              <Link href={`/apps/${product.appId}/overview`}>
                {product.name} ({product.appId})
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

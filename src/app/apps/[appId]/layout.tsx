import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PRODUCT_CATALOG, findProduct } from '@/domain/scope';
import { AppTabs } from '@/components/AppTabs';

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  const product = findProduct(Number(appId));
  if (!product) notFound();

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="masthead-top">
            <div className="product-title">
              <Link href="/" className="brand">
                GGG Steam Intelligence
              </Link>
              <h1>{product.name}</h1>
              <span className="appid">AppID {product.appId}</span>
            </div>
            <span className="appid">
              {PRODUCT_CATALOG.length} product{PRODUCT_CATALOG.length === 1 ? '' : 's'} catalogued
            </span>
          </div>
          <AppTabs appId={product.appId} />
        </div>
      </header>
      <main className="shell">{children}</main>
    </>
  );
}

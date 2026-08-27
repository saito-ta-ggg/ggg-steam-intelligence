import { redirect } from 'next/navigation';
import { PRODUCT_CATALOG } from '@/domain/scope';

/**
 * The app is a reusable app-detail experience, so the entry point simply lands on
 * the first catalogued product rather than hard-coding a title.
 */
export default function HomePage() {
  const first = PRODUCT_CATALOG[0];
  if (!first) throw new Error('PRODUCT_CATALOG is empty.');
  redirect(`/apps/${first.appId}/overview`);
}

'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

/** Navigation from docs/REQUIREMENTS.md, in the specified order. */
const TABS = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'sales', label: 'Sales' },
  { slug: 'pricing', label: 'Pricing & Sales' },
  { slug: 'countries', label: 'Countries' },
  { slug: 'dlc', label: 'DLC' },
  { slug: 'reviews', label: 'Reviews' },
  { slug: 'updates', label: 'Updates' },
] as const;

export function AppTabs({ appId }: { readonly appId: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const activeSlug = pathname.split('/').at(-1);

  return (
    <nav className="tabs" aria-label="Product sections">
      {TABS.map((tab) => {
        const href = `/apps/${appId}/${tab.slug}${query ? `?${query}` : ''}`;
        return (
          <Link key={tab.slug} className="tab" href={href} aria-current={activeSlug === tab.slug ? 'page' : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

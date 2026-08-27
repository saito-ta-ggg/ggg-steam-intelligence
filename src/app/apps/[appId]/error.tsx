'use client';

import { useEffect } from 'react';

/**
 * UI_SPEC.md safeguard: a failed query must never degrade into zeros or a blank
 * table that reads as "no sales". The failure is stated plainly instead.
 */
export default function ProductError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error('Product page query failed', error);
  }, [error]);

  return (
    <div className="empty" style={{ marginTop: 24 }}>
      <h3>This view could not be loaded</h3>
      <p>
        The data layer returned an error, so no figures are shown. An empty or zeroed table would be
        indistinguishable from a genuine result, so nothing is rendered in its place.
      </p>
      {error.digest ? (
        <p className="footnote">
          Error digest <code>{error.digest}</code>
        </p>
      ) : null}
      <p style={{ marginTop: 14 }}>
        <button className="button" type="button" onClick={reset}>
          Retry
        </button>
      </p>
    </div>
  );
}

/**
 * Every product page is server-rendered on demand, so a loading state is shown
 * while the repository query runs. It deliberately renders no numbers and no
 * skeleton shaped like a figure: a placeholder that resembles data is exactly
 * how a fabricated value reaches a screenshot.
 */
export default function Loading() {
  return (
    <div className="empty" style={{ marginTop: 24 }}>
      <h3>Loading</h3>
      <p>Querying the data layer for the selected product, date range and scope.</p>
    </div>
  );
}

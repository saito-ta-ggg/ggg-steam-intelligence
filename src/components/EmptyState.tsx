/**
 * UI_SPEC.md: unconnected data sources show a clear "data not yet connected"
 * state. Values are never fabricated to fill a placeholder.
 */
export function EmptyState({
  title,
  description,
  requirements,
}: {
  readonly title: string;
  readonly description: string;
  readonly requirements?: readonly string[];
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{description}</p>
      {requirements && requirements.length > 0 ? (
        <ul>
          {requirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

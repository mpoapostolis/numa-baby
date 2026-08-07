export function InstantLogCard({
  title,
  description,
  icon,
  children,
  className = "",
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`instant-card ${className}`} aria-label={title}>
      <div className="instant-card-heading">
        <span className="action-icon">{icon}</span>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
      </div>
      <div className="instant-card-actions">{children}</div>
    </section>
  );
}

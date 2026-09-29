function Card({ children, className = "", headerAction, title }) {
  return (
    <section className={`overflow-hidden rounded-lg bg-white shadow-md ${className}`}>
      {title && (
        <header className="flex min-h-12 items-center justify-between gap-3 bg-gradient-to-r from-yellow-400 to-yellow-500 px-5 py-3">
          <h2 className="font-display text-sm font-bold text-slate-800">{title}</h2>
          {headerAction}
        </header>
      )}
      <div className="bg-white p-5 sm:p-6">{children}</div>
    </section>
  );
}

export default Card;
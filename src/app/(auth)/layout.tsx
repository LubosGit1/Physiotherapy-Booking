export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md rounded-2xl border border-line bg-card p-6 sm:p-8">{children}</div>;
}

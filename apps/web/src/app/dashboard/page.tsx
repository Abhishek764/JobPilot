import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';

export default async function DashboardPage() {
  const user = await currentUser();
  return (
    <main className="container py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <UserButton />
      </header>
      <p className="text-muted-foreground">
        Welcome back{user?.firstName ? `, ${user.firstName}` : ''}.
      </p>
    </main>
  );
}

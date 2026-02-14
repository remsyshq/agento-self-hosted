'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Key, LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth-client';

interface NavProps {
  user: { name: string; email: string };
}

export function Nav({ user }: NavProps) {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Agents', icon: Bot },
    { href: '/providers', label: 'Providers', icon: Key },
  ];

  return (
    <header className="border-b border-[var(--border)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-bold">
            Agento
          </Link>
          <nav className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                    active
                      ? 'bg-[var(--accent)] text-[var(--foreground)]'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--muted-foreground)]">{user.email}</span>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}

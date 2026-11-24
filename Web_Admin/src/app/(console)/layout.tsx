import { Console_Shell } from '@/components/Console_Shell';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <Console_Shell>{children}</Console_Shell>;
}

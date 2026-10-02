import { AppShell } from "@/components/shell/app-shell";

export default function WebLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}

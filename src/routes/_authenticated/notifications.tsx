import { createFileRoute } from "@tanstack/react-router";
import { NotificationSettingsView } from "@/features/notifications/components/NotificationSettingsView";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationSettingsPage,
  head: () => ({ meta: [{ title: "Notifications — GlucoLab" }] }),
});

function NotificationSettingsPage() {
  return <NotificationSettingsView />;
}

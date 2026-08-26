import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import BtrApp from "@/components/BtrApp";
import InstallPrompt from "@/components/InstallPrompt";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BTR ትምህርት:Freshman" },
      {
        name: "description",
        content:
          "BTR Learning app for students and admins: schedules, study materials, notes, announcements and payments in one place.",
      },
      { property: "og:title", content: "BTR ትምህርት:Freshman" },
      {
        property: "og:description",
        content:
          "BTR Learning app for students and admins: schedules, study materials, notes, announcements and payments in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-white" />}>
      <BtrApp />
      <InstallPrompt />
    </ClientOnly>
  );
}

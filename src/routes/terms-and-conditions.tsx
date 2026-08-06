import { createFileRoute } from "@tanstack/react-router";
import TermsPage from "./terms";

export const Route = createFileRoute("/terms-and-conditions")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms & Conditions — GlucoLab | Personal Diabetes Management" },
      {
        name: "description",
        content:
          "Terms & Conditions for GlucoLab by Viora Technology. Rules, eligibility, medical disclaimers, user rights, and service terms.",
      },
      { property: "og:title", content: "Terms & Conditions — GlucoLab" },
      {
        property: "og:description",
        content:
          "Official Terms & Conditions for using GlucoLab mobile and web applications developed by Viora Technology.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.vioraa.app/terms-and-conditions" },
      { rel: "canonical", href: "https://www.vioraa.app/terms-and-conditions" },
    ],
  }),
});

import { createFileRoute } from "@tanstack/react-router";
import DeleteAccountPage from "./delete-account";

export const Route = createFileRoute("/account-deletion")({
  component: DeleteAccountPage,
  head: () => ({
    meta: [
      { title: "Account & Data Deletion Policy — GlucoLab" },
      {
        name: "description",
        content:
          "Request account deletion and learn how GlucoLab handles user data, deletion requests, and retention policies in compliance with Google Play Store standards.",
      },
    ],
  }),
});

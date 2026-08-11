import type { Metadata } from "next";
import { ClubPlanner } from "./ClubPlanner";

export const metadata: Metadata = {
  title: { absolute: "Project Workspace" },
  description:
    "The shared project, milestone, task, deliverable, and reminder workspace for any team.",
};

export default function Home() {
  return <ClubPlanner />;
}

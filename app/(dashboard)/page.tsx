import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { redirect } from "next/navigation";
import {
  flowViewIsEnabled,
  isFlowViewRequested,
} from "@/lib/flow-feature-flag";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  if (
    isFlowViewRequested(params.view) &&
    !flowViewIsEnabled(params.flow)
  ) {
    redirect("/");
  }

  return <DashboardPage />;
}
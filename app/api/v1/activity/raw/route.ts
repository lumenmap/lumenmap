import { handleFlowRequest } from "../../../flow/_handler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleFlowRequest(request);
}

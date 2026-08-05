import { handleRawActivityRequest } from "../../../activity/_handler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRawActivityRequest(request);
}

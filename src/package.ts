import { Connection, RequestMethod } from "./connection";
import { StatusReply, statusReplyFromApi } from "./error";

export interface Package {
  name: string;
  project: string;
}

export async function deletePackage(
  con: Connection,
  pkg: Package
): Promise<StatusReply> {
  const response = await con.makeApiCall(`/source/${pkg.project}/${pkg.name}`, {
    method: RequestMethod.DELETE
  });
  return statusReplyFromApi(response);
}

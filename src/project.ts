import {
  modifyProjectMeta,
  ProjectMeta
} from "./api/project-meta";
import { Connection, RequestMethod } from "./connection";
import { StatusReply, statusReplyFromApi } from "./error";




export async function createProject(
  con: Connection,
  proj: ProjectMeta
): Promise<StatusReply> {
  return modifyProjectMeta(con, proj);
}

export async function deleteProject(
  con: Connection,
  projectName: string
): Promise<StatusReply> {
  const resp = await con.makeApiCall(`/source/${projectName}`, {
    method: RequestMethod.DELETE
  });
  return statusReplyFromApi(resp);
}

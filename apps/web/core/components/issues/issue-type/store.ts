/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observable, runInAction } from "mobx";
// services
import { WorkspaceService } from "@/services/workspace.service";

// Fork: the issue list and detail endpoints do not return type_id, the entity search endpoint does.
// This map holds issue id -> type id for every project a type chip has rendered in.
const workspaceService = new WorkspaceService();
const typeIdByIssueId = observable.map<string, string | null>();
const projectLoads = new Map<string, Promise<void>>();

export const getIssueTypeId = (issueId: string): string | null => typeIdByIssueId.get(issueId) ?? null;

export const setIssueTypeId = (issueId: string, typeId: string | null) => {
  runInAction(() => typeIdByIssueId.set(issueId, typeId));
};

/** Loads the type of every work item in a project once; `force` reloads (used by the 30 s board refresh). */
export const loadProjectIssueTypes = (workspaceSlug: string, projectId: string, force = false): Promise<void> => {
  const key = `${workspaceSlug}/${projectId}`;
  const pending = projectLoads.get(key);
  if (pending && !force) return pending;

  const request = workspaceService
    .searchEntity(workspaceSlug, { query_type: ["issue"], project_id: projectId, query: "", count: 10000 })
    .then((response) => {
      runInAction(() => {
        response.issue?.forEach((issue) => typeIdByIssueId.set(issue.id, issue.type_id ?? null));
      });
      return;
    })
    .catch(() => {
      // retried on the next render or refresh
      projectLoads.delete(key);
    });
  projectLoads.set(key, request);
  return request;
};

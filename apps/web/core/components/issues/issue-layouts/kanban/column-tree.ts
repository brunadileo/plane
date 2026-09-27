/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TKanbanColumnTree = {
  // issues rendered as top level cards, in column order
  rootIds: string[];
  // issues rendered nested under a parent card of the same column, in column order
  childIdsByParentId: Record<string, string[]>;
};

/**
 * Splits the issue ids of one kanban column into a tree: an issue whose parent is in the same column
 * is nested under that parent, every other issue stays a top level card.
 * @param issueIds issue ids of the column, in display order
 * @param getParentId returns the parent id of an issue, if any
 */
export const buildKanbanColumnTree = (
  issueIds: string[],
  getParentId: (issueId: string) => string | null | undefined
): TKanbanColumnTree => {
  const idsInColumn = new Set(issueIds);

  const getParentInColumn = (issueId: string) => {
    const parentId = getParentId(issueId);
    return parentId && parentId !== issueId && idsInColumn.has(parentId) ? parentId : undefined;
  };

  // an issue whose parent chain loops would never be reached from a top level card, so it stays top level
  const isInCycle = (issueId: string) => {
    const visited = new Set<string>([issueId]);
    let currentId = getParentInColumn(issueId);
    while (currentId) {
      if (visited.has(currentId)) return true;
      visited.add(currentId);
      currentId = getParentInColumn(currentId);
    }
    return false;
  };

  const rootIds: string[] = [];
  const childIdsByParentId: Record<string, string[]> = {};

  for (const issueId of issueIds) {
    const parentId = getParentInColumn(issueId);
    if (!parentId || isInCycle(issueId)) {
      rootIds.push(issueId);
      continue;
    }
    (childIdsByParentId[parentId] ??= []).push(issueId);
  }

  return { rootIds, childIdsByParentId };
};

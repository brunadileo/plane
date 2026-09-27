/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject, ReactNode } from "react";
import { Fragment } from "react";
import { observer } from "mobx-react";
// plane imports
import type { TIssue, IIssueDisplayProperties, IIssueMap } from "@plane/types";
// local imports
import type { TRenderQuickActions } from "../list/list-view-types";
import { KanbanIssueBlock } from "./block";
import { buildKanbanColumnTree } from "./column-tree";

interface IssueBlocksListProps {
  sub_group_id: string;
  groupId: string;
  issuesMap: IIssueMap;
  issueIds: string[];
  displayProperties: IIssueDisplayProperties | undefined;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  canEditProperties: (projectId: string | undefined) => boolean;
  canDropOverIssue: boolean;
  canDragIssuesInCurrentGrouping: boolean;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
  isEpic?: boolean;
}

export const KanbanIssueBlocksList = observer(function KanbanIssueBlocksList(props: IssueBlocksListProps) {
  const {
    sub_group_id,
    groupId,
    issuesMap,
    issueIds,
    displayProperties,
    canDropOverIssue,
    canDragIssuesInCurrentGrouping,
    updateIssue,
    quickActions,
    canEditProperties,
    scrollableContainerRef,
    isEpic = false,
  } = props;

  // sub-issues whose parent is in this column render nested under the parent card
  const { rootIds, childIdsByParentId } = buildKanbanColumnTree(
    issueIds.filter((issueId) => !!issueId),
    (issueId) => issuesMap[issueId]?.parent_id
  );

  let renderIndex = 0;

  const renderIssueBlock = (issueId: string, isNested: boolean): ReactNode => {
    const index = renderIndex++;

    let draggableId = issueId;
    if (groupId) draggableId = `${draggableId}__${groupId}`;
    if (sub_group_id) draggableId = `${draggableId}__${sub_group_id}`;

    const childIds = childIdsByParentId[issueId];

    return (
      <Fragment key={draggableId}>
        <KanbanIssueBlock
          issueId={issueId}
          groupId={groupId}
          subGroupId={sub_group_id}
          shouldRenderByDefault={index <= 10}
          issuesMap={issuesMap}
          displayProperties={displayProperties}
          updateIssue={updateIssue}
          quickActions={quickActions}
          draggableId={draggableId}
          canDropOverIssue={canDropOverIssue}
          canDragIssuesInCurrentGrouping={canDragIssuesInCurrentGrouping}
          canEditProperties={canEditProperties}
          scrollableContainerRef={scrollableContainerRef}
          showParentReference={!isNested}
          isEpic={isEpic}
        />
        {childIds && childIds.length > 0 && (
          <div className="ml-3 border-l-2 border-subtle pl-2">
            {childIds.map((childId) => renderIssueBlock(childId, true))}
          </div>
        )}
      </Fragment>
    );
  };

  return <>{rootIds.length > 0 ? rootIds.map((issueId) => renderIssueBlock(issueId, false)) : null}</>;
});

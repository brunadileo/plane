/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Check } from "lucide-react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TIssueIdentifierSize } from "@plane/types";
import { CustomMenu } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local imports
import { WORK_ITEM_TYPES, getWorkItemType } from "./constants";

const SIZE_MAP: Record<TIssueIdentifierSize, string> = {
  xs: "text-caption-sm-medium",
  sm: "text-caption-sm-medium",
  md: "text-caption-md-medium",
  lg: "text-caption-lg-medium",
};

type TIssueTypeChipProps = {
  typeId: string | null | undefined;
  onChange: (typeId: string) => void;
  size?: TIssueIdentifierSize;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/** Tinted type name; click opens the list of types. Clicks never reach the card underneath. */
export function IssueTypeChip(props: TIssueTypeChipProps) {
  const { typeId, onChange, size = "xs", placeholder, disabled = false, className } = props;
  const type = getWorkItemType(typeId);

  if (!type && !placeholder) return null;

  return (
    <CustomMenu
      customButton={
        <span
          className={cn(
            "inline-flex items-center rounded-sm px-1.5 leading-[1.5] whitespace-nowrap",
            SIZE_MAP[size],
            { "border border-strong text-tertiary": !type },
            className
          )}
          style={type ? { color: type.color, backgroundColor: `${type.color}21` } : undefined}
        >
          {type ? type.name : placeholder}
        </span>
      }
      customButtonClassName="flex items-center"
      disabled={disabled}
      placement="bottom-start"
      closeOnSelect
      ariaLabel="Work item type"
    >
      {WORK_ITEM_TYPES.map((option) => (
        <CustomMenu.MenuItem key={option.id} onClick={() => onChange(option.id)}>
          <div className="flex items-center gap-2">
            <span className="size-2 flex-shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
            <span className="flex-grow">{option.name}</span>
            {option.id === typeId && <Check className="size-3 flex-shrink-0" />}
          </div>
        </CustomMenu.MenuItem>
      ))}
    </CustomMenu>
  );
}

type TIssueTypeChipForIssueProps = {
  issueId: string;
  projectId: string;
  size?: TIssueIdentifierSize;
};

/** The chip for a saved work item: reads `type_id` from the work item, saves a pick through the issue store. */
export const IssueTypeChipForIssue = observer(function IssueTypeChipForIssue(props: TIssueTypeChipForIssueProps) {
  const { issueId, projectId, size } = props;
  const { workspaceSlug } = useParams();
  const slug = workspaceSlug?.toString();
  const {
    issue: { getIssueById },
    updateIssue,
  } = useIssueDetail();

  const typeId = getIssueById(issueId)?.type_id ?? null;
  if (!slug || !getWorkItemType(typeId)) return null;

  const handleChange = async (newTypeId: string) => {
    if (newTypeId === typeId) return;
    try {
      await updateIssue(slug, projectId, issueId, { type_id: newTypeId });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Could not change the work item type" });
    }
  };

  return <IssueTypeChip typeId={typeId} onChange={(id) => void handleChange(id)} size={size} />;
});

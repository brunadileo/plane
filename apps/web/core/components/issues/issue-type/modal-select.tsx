/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import type { Control } from "react-hook-form";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import type { TIssue } from "@plane/types";
// local imports
import { IssueTypeChip } from "./chip";
import { DEFAULT_WORK_ITEM_TYPE_ID } from "./constants";
import { getIssueTypeId } from "./store";

type Props = {
  control: Control<TIssue>;
  issueId: string | undefined;
  handleFormChange: () => void;
};

/** Type picker in the create/edit modal. New work items start as build; edits start from the saved type. */
export const IssueTypeModalSelect = observer(function IssueTypeModalSelect(props: Props) {
  const { control, issueId, handleFormChange } = props;
  const { getValues, setValue } = useFormContext<TIssue>();
  const formTypeId = useWatch({ control, name: "type_id" });

  // New work items start as build. Deferred one tick so the form's own reset on open does not wipe it.
  useEffect(() => {
    if (issueId || formTypeId) return;
    const timer = window.setTimeout(() => {
      if (!getValues("type_id")) setValue("type_id", DEFAULT_WORK_ITEM_TYPE_ID);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [issueId, formTypeId, getValues, setValue]);

  return (
    <Controller
      control={control}
      name="type_id"
      render={({ field: { value, onChange } }) => (
        <div className="flex h-7 items-center">
          <IssueTypeChip
            typeId={value ?? (issueId ? getIssueTypeId(issueId) : null)}
            onChange={(typeId) => {
              onChange(typeId);
              handleFormChange();
            }}
            size="md"
            placeholder="Type"
            className="h-7"
          />
        </div>
      )}
    />
  );
});

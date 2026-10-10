/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Shapes } from "lucide-react";
import type { TFilterProperty } from "@plane/types";
import { COLLECTION_OPERATOR, EQUALITY_OPERATOR } from "@plane/types";
import type { TCreateFilterConfigParams } from "@plane/utils";
import { createFilterConfig, createOperatorConfigEntry, getMultiSelectConfig } from "@plane/utils";
// local imports
import type { TWorkItemType } from "./constants";
import { WORK_ITEM_TYPES } from "./constants";

/** Fork: "Type" in the board's filter menu, one option per work item type (backend filter key type_id). */
export const getIssueTypeFilterConfig = <P extends TFilterProperty>(key: P, params: TCreateFilterConfigParams) =>
  createFilterConfig<P>({
    id: key,
    label: "Type",
    ...params,
    icon: Shapes,
    supportedOperatorConfigsMap: new Map([
      createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
        getMultiSelectConfig<TWorkItemType, string, string>(
          {
            items: WORK_ITEM_TYPES,
            getId: (type) => type.id,
            getLabel: (type) => type.name,
            getValue: (type) => type.id,
            getIconData: (type) => type.color,
          },
          { singleValueOperator: EQUALITY_OPERATOR.EXACT, ...updatedParams },
          {
            getOptionIcon: (color) => (
              <span className="flex size-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
            ),
          }
        )
      ),
    ]),
  });

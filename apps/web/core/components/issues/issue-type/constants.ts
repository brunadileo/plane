/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Fork: the work item types that exist in Bruna's database. The community API has no endpoint that
// lists types, so the ids are copied from the issue_types table. To add a type, insert the row (and its
// project link) in the database first, then add it here with the same id.
export type TWorkItemType = {
  id: string;
  name: string;
  color: string;
};

export const WORK_ITEM_TYPES: TWorkItemType[] = [
  { id: "47dff625-4e5d-486a-a49a-43d24840a014", name: "build", color: "#3B82F6" },
  { id: "7d0d020c-2f53-40c9-aba5-7b31d3e853ae", name: "fix", color: "#EF4444" },
  { id: "883ff592-09dd-42e3-ab3a-abfb98cea1b5", name: "research", color: "#8B5CF6" },
  { id: "da25935e-a1ba-44a3-95df-769acea30384", name: "ops", color: "#6B7280" },
];

export const DEFAULT_WORK_ITEM_TYPE_ID = WORK_ITEM_TYPES[0].id;

export const getWorkItemType = (typeId: string | null | undefined): TWorkItemType | undefined =>
  typeId ? WORK_ITEM_TYPES.find((type) => type.id === typeId) : undefined;

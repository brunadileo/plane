/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { RichTextEditor } from "@/components/editor/rich-text";
import { useWorkspace } from "@/hooks/store/use-workspace";

const READ_ONLY_CLASS = "p-0! pl-0! border-none";

/** Read-only rich text, the same way the description tabs show a description. No raw HTML injection. */
export function ReadOnlyHtml(props: { id: string; html: string; workspaceSlug: string; projectId: string }) {
  const { id, html, workspaceSlug, projectId } = props;
  const { getWorkspaceBySlug } = useWorkspace();
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id;
  if (!workspaceId || !html) return null;
  return (
    <RichTextEditor
      editable={false}
      containerClassName={READ_ONLY_CLASS}
      editorClassName="pl-0"
      id={id}
      initialValue={html}
      projectId={projectId}
      workspaceId={workspaceId}
      workspaceSlug={workspaceSlug}
    />
  );
}

/** Drops the test block's own heading and its "Reply pass" line, keeping the steps. */
export function stepsOnly(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.body.querySelector("h3")?.remove();
  Array.from(doc.body.querySelectorAll("p")).forEach((p) => {
    const text = p.textContent ?? "";
    if (/^\s*Reply pass/i.test(text) || /^\s*Pass closes this card/i.test(text)) p.remove();
  });
  return doc.body.innerHTML;
}

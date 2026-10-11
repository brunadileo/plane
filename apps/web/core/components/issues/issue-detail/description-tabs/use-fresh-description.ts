/**
 * Fork: work item descriptions have no live sync, so an open card keeps the description it loaded with.
 * This re-reads the open card's description every 30 s, on tab focus and when asked, and puts a changed one
 * in the store, so a description written elsewhere (API, MCP, another device) reaches the open card.
 */

import { useCallback } from "react";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useAutoRefreshIssues } from "@/hooks/use-auto-refresh-issues";
// services
import { IssueService } from "@/services/issue";

const issueService = new IssueService();

export const useFreshDescription = (workspaceSlug: string, projectId: string | undefined, issueId: string) => {
  const {
    rootIssueStore: { issues },
  } = useIssueDetail();

  const refresh = useCallback(async () => {
    if (!workspaceSlug || !projectId || !issueId) return;
    const before = issues.getIssueById(issueId)?.description_html;
    const fresh = await issueService.retrieve(workspaceSlug, projectId, issueId);
    if (typeof fresh?.description_html !== "string") return;
    const now = issues.getIssueById(issueId)?.description_html;
    // a local save landed while fetching; the next run reads it back from the server
    if (now !== before) return;
    if (fresh.description_html !== now) issues.updateIssue(issueId, { description_html: fresh.description_html });
  }, [workspaceSlug, projectId, issueId, issues]);

  useAutoRefreshIssues(refresh, () => false);

  return refresh;
};

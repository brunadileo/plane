/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAutoRefreshIssues } from "@/hooks/use-auto-refresh-issues";
import type { TNeedsMe, TNeedsMeDone } from "@/services/needs-me.service";
import { needsMeService } from "@/services/needs-me.service";

export const PASS_UNDO_MS = 5000;

export type TPendingPass = { issueId: string; key: string; closes: boolean };

export const PASS_ERROR_TEXT = "Pass not sent, try again";
export const SEEN_ERROR_TEXT = "Not saved, try again";

const statusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | undefined)?.response?.status;

const detailOf = (error: unknown): string | undefined => {
  const detail = (error as { response?: { data?: { detail?: unknown } } } | undefined)?.response?.data?.detail;
  return typeof detail === "string" ? detail : undefined;
};

export const ALREADY_HANDLED = "already handled";
const OFFLINE_TEXT = "You are offline, so Inbox could not load. The board still works.";

/**
 * Data and actions of the Inbox page. Timers and in-flight requests live here, not in the rows, so
 * the Undo toast and error lines keep working when a row is collapsed or gone.
 */
export const useNeedsMe = (workspaceSlug: string) => {
  const [data, setData] = useState<TNeedsMe | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [errorText, setErrorText] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);
  const [refreshFailed, setRefreshFailed] = useState(false);
  // Pass: rows waiting out the Undo window or being sent are hidden from the tests list
  const [passes, setPasses] = useState<TPendingPass[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [seenAllBusy, setSeenAllBusy] = useState(false);

  const timers = useRef(new Map<string, number>());
  const inFlight = useRef(0);
  const fetching = useRef(false);
  const rerun = useRef(false);
  const hasData = useRef(false);
  // Fetches started so far. A passed card stays hidden until a fetch that started after its POST
  // finished has come back (an older in-flight fetch could still list it).
  const fetchSeq = useRef(0);
  const [hidden, setHidden] = useState<Record<string, number>>({});

  // queue: when a fetch is already running, run one more right after it (used after a write)
  const refresh = useCallback(
    async (queue = false) => {
      if (fetching.current) {
        if (queue) rerun.current = true;
        return;
      }
      fetching.current = true;
      fetchSeq.current += 1;
      const seq = fetchSeq.current;
      try {
        const next = await needsMeService.fetch(workspaceSlug);
        hasData.current = true;
        setData(next);
        setStatus("ok");
        setUpdatedAt(new Date());
        setOnline(true);
        setRefreshFailed(false);
        setHidden((h) => {
          const kept = Object.entries(h).filter(([, since]) => since >= seq);
          return kept.length === Object.keys(h).length ? h : Object.fromEntries(kept);
        });
      } catch (error) {
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        if (offline) setOnline(false);
        if (hasData.current) {
          if (!offline) setRefreshFailed(true);
        } else {
          setStatus("error");
          const code = statusOf(error);
          setErrorText(
            offline
              ? OFFLINE_TEXT
              : code
                ? `Inbox could not load (server answered ${code}). The board still works.`
                : "Inbox could not load. The board still works."
          );
        }
      } finally {
        fetching.current = false;
        if (rerun.current) {
          rerun.current = false;
          void refresh();
        }
      }
    },
    [workspaceSlug]
  );

  useEffect(() => {
    void refresh();
    const goOffline = () => setOnline(false);
    const goOnline = () => {
      setOnline(true);
      void refresh();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [refresh]);

  // every 30 s while visible and on tab focus; not while a write is in flight
  useAutoRefreshIssues(refresh, () => inFlight.current > 0);

  const retry = useCallback(() => {
    setStatus("loading");
    void refresh();
  }, [refresh]);

  const dropTest = (issueId: string) => {
    setData((d) => (d ? { ...d, tests: d.tests.filter((t) => t.issue_id !== issueId) } : d));
    setHidden((h) => ({ ...h, [issueId]: fetchSeq.current }));
  };

  const sendPass = useCallback(
    async (issueId: string) => {
      timers.current.delete(issueId);
      inFlight.current += 1;
      try {
        await needsMeService.pass(workspaceSlug, issueId);
        dropTest(issueId);
      } catch (error) {
        const detail = detailOf(error);
        if (statusOf(error) === 409 && detail === ALREADY_HANDLED) dropTest(issueId);
        else if (statusOf(error) === 409 && detail)
          setRowErrors((e) => ({ ...e, [issueId]: `Pass not sent: ${detail}` }));
        else setRowErrors((e) => ({ ...e, [issueId]: PASS_ERROR_TEXT }));
      } finally {
        inFlight.current -= 1;
        setPasses((p) => p.filter((x) => x.issueId !== issueId));
        void refresh(true);
      }
    },
    [workspaceSlug, refresh]
  );

  // leaving the page: send what is still waiting out its Undo window, no state updates
  useEffect(() => {
    const waiting = timers.current;
    return () => {
      waiting.forEach((timer, issueId) => {
        window.clearTimeout(timer);
        void needsMeService.pass(workspaceSlug, issueId).catch(() => undefined);
      });
      waiting.clear();
    };
  }, [workspaceSlug]);

  const pass = useCallback(
    (item: TPendingPass) => {
      if (timers.current.has(item.issueId)) return;
      setRowErrors((e) => {
        const { [item.issueId]: _gone, ...rest } = e;
        return rest;
      });
      setPasses((p) => [...p, item]);
      timers.current.set(
        item.issueId,
        window.setTimeout(() => void sendPass(item.issueId), PASS_UNDO_MS)
      );
    },
    [sendPass]
  );

  const undoPass = useCallback((issueId: string) => {
    const timer = timers.current.get(issueId);
    if (timer === undefined) return;
    window.clearTimeout(timer);
    timers.current.delete(issueId);
    setPasses((p) => p.filter((x) => x.issueId !== issueId));
  }, []);

  const seenOne = useCallback(
    async (issueId: string, at: string) => {
      setRowErrors((e) => {
        const { [issueId]: _gone, ...rest } = e;
        return rest;
      });
      setSeenIds((s) => [...s, issueId]);
      inFlight.current += 1;
      try {
        await needsMeService.seenOne(workspaceSlug, issueId, at);
        setData((d) => (d ? { ...d, done: d.done.filter((x) => x.issue_id !== issueId) } : d));
        // same ordering protection as Pass: a fetch already in flight cannot bring the row back
        setHidden((h) => ({ ...h, [issueId]: fetchSeq.current }));
        void refresh(true);
      } catch {
        setRowErrors((e) => ({ ...e, [issueId]: SEEN_ERROR_TEXT }));
      } finally {
        inFlight.current -= 1;
        setSeenIds((s) => s.filter((x) => x !== issueId));
      }
    },
    [workspaceSlug, refresh]
  );

  // rows: only these Done rows (a project filter is on); null marks the whole list
  const seenAll = useCallback(
    async (rows: TNeedsMeDone[] | null) => {
      if (!data) return;
      const before = data;
      const gone = new Set((rows ?? before.done).map((x) => x.issue_id));
      setSeenAllBusy(true);
      setData((d) => (d ? { ...d, done: rows ? d.done.filter((x) => !gone.has(x.issue_id)) : [] } : d));
      inFlight.current += 1;
      let failed = new Set<string>();
      try {
        if (rows) {
          const results = await Promise.allSettled(
            rows.map((x) => needsMeService.seenOne(workspaceSlug, x.issue_id, x.at))
          );
          failed = new Set(rows.filter((_, i) => results[i].status === "rejected").map((x) => x.issue_id));
          if (failed.size > 0) throw new Error("some rows not saved");
        } else {
          await needsMeService.seenAll(workspaceSlug, data.generated_at);
        }
        setRowErrors((e) => {
          const { __all: _gone, ...rest } = e;
          return rest;
        });
      } catch {
        // put back only what the server did not take (everything for the whole-list mark)
        const back = rows ? before.done.filter((x) => failed.has(x.issue_id)) : before.done;
        back.forEach((x) => gone.delete(x.issue_id));
        setData((d) =>
          d ? { ...d, done: [...d.done, ...back.filter((x) => !d.done.some((y) => y.issue_id === x.issue_id))] } : d
        );
        setRowErrors((e) => ({ ...e, __all: SEEN_ERROR_TEXT }));
      } finally {
        setHidden((h) => ({ ...h, ...Object.fromEntries([...gone].map((id) => [id, fetchSeq.current])) }));
        void refresh(true);
        inFlight.current -= 1;
        setSeenAllBusy(false);
      }
    },
    [data, workspaceSlug, refresh]
  );

  const passingIds = new Set([...passes.map((p) => p.issueId), ...Object.keys(hidden)]);

  return {
    data,
    status,
    errorText,
    updatedAt,
    online,
    retry,
    refreshFailed,
    passes,
    pass,
    undoPass,
    rowErrors,
    seenIds: [...seenIds, ...Object.keys(hidden)],
    seenOne,
    seenAll,
    seenAllBusy,
    tests: (data?.tests ?? []).filter((t) => !passingIds.has(t.issue_id)),
  };
};

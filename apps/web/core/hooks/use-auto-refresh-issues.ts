/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";

const REFRESH_INTERVAL_MS = 30_000;

/**
 * Quietly re-runs `refresh` every 30 seconds while the tab is visible, and once when the tab
 * becomes visible again, so cards changed elsewhere (API, MCP, another device) show up without a reload.
 * Skips a run while a card is being dragged or while `isBusy` says a fetch is already running.
 */
export const useAutoRefreshIssues = (refresh: (() => Promise<unknown>) | undefined, isBusy: () => boolean) => {
  const refreshRef = useRef(refresh);
  const isBusyRef = useRef(isBusy);
  refreshRef.current = refresh;
  isBusyRef.current = isBusy;

  useEffect(() => {
    let isDragging = false;
    let isRunning = false;

    const run = async () => {
      if (document.visibilityState !== "visible" || isDragging || isRunning || isBusyRef.current()) return;
      if (!refreshRef.current) return;
      isRunning = true;
      try {
        await refreshRef.current();
      } catch {
        // a failed background refresh is retried on the next tick
      } finally {
        isRunning = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void run();
    };
    const onDragStart = () => (isDragging = true);
    const onDragEnd = () => (isDragging = false);

    const interval = window.setInterval(() => void run(), REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragend", onDragEnd);
    document.addEventListener("drop", onDragEnd);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragend", onDragEnd);
      document.removeEventListener("drop", onDragEnd);
    };
  }, []);
};

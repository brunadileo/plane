/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { Button } from "@plane/propel/button";
import { cn } from "@plane/utils";
import { useNeedsMe, PASS_UNDO_MS } from "./use-needs-me";
import { DecisionRow, DoneRow, RunningRow, TestRow } from "./rows";

function Section(props: {
  id: string;
  title: string;
  count?: number;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={props.id} aria-labelledby={`${props.id}-h`} className="mb-7 scroll-mt-3">
      <div className="mb-2 flex items-center gap-2.5">
        <h2 id={`${props.id}-h`} className="text-15 font-semibold text-primary">
          {props.title}
          {props.count !== undefined && <span className="ml-2 font-medium text-tertiary">{props.count}</span>}
        </h2>
        {props.hint && <span className="text-13 text-tertiary max-sm:hidden">{props.hint}</span>}
        {props.action && <span className="ml-auto">{props.action}</span>}
      </div>
      <div className="overflow-hidden rounded-xl border border-subtle">{props.children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <div className="px-3.5 py-4 text-13 text-tertiary">{children}</div>
);
const Skeleton = () => <div className="h-12 animate-pulse border-t border-subtle bg-layer-1 first:border-t-0" />;

export function NeedsMeRoot({ workspaceSlug }: { workspaceSlug: string }) {
  const n = useNeedsMe(workspaceSlug);
  const { data } = n;

  if (n.status === "loading" || (n.status === "error" && !data)) {
    return (
      <div className="mx-auto max-w-[760px] px-6 py-5 max-sm:px-4">
        {n.status === "error" ? (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-xl border border-danger-strong bg-danger-subtle p-3.5 text-danger-primary"
          >
            <span className="flex-1">{n.errorText}</span>
            <Button variant="secondary" className="h-8 max-sm:h-11" onClick={n.retry}>
              Try again
            </Button>
          </div>
        ) : (
          ["Tests for you", "Decisions for you", "Done since you last looked", "Running"].map((t) => (
            <div key={t} className="mb-7" aria-busy="true">
              <h2 className="text-15 mb-2 font-semibold text-primary">{t}</h2>
              <div className="overflow-hidden rounded-xl border border-subtle">
                <Skeleton />
                <Skeleton />
              </div>
            </div>
          ))
        )}
      </div>
    );
  }
  if (!data) return null;

  const done = data.done.filter((d) => !n.seenIds.includes(d.issue_id));
  const chips: [string, string, number, string][] = [
    ["tests", "tests", n.tests.length, "#tests"],
    ["decisions", "decisions", data.decisions.length, "#decisions"],
    ["done", "done since you looked", done.length, "#done"],
    ["running", "running", data.running.length, "#running"],
  ];
  const sinceLabel = data.seen_at
    ? new Date(data.seen_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })
    : "your last look";

  return (
    <div className="mx-auto max-w-[760px] px-6 py-5 pb-16 max-sm:px-4 max-sm:pb-[72px]">
      <p className="mb-3 text-12 text-tertiary" aria-live="polite">
        {n.online
          ? `Updated ${n.updatedAt ? n.updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "just now"}`
          : `Offline, showing ${n.updatedAt ? n.updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "last load"}`}
        {n.online && n.refreshFailed && <span className="ml-2 text-danger-primary">Could not refresh</span>}
      </p>
      <nav aria-label="Sections" className="mb-5 flex flex-wrap gap-2">
        {chips.map(([k, label, count, href]) => (
          <a
            key={k}
            href={href}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-subtle px-3 text-13 font-medium whitespace-nowrap max-sm:min-h-11",
              count === 0 ? "text-tertiary" : "text-primary"
            )}
          >
            <b className="font-semibold">{count}</b> {label}
          </a>
        ))}
      </nav>

      <Section id="tests" title="Tests for you" count={n.tests.length} hint="quickest first">
        {n.tests.length === 0 ? (
          <Empty>No tests waiting. When Claude hands you one, its steps show here.</Empty>
        ) : (
          n.tests.map((t) => (
            <TestRow key={t.issue_id} slug={workspaceSlug} item={t} error={n.rowErrors[t.issue_id]} onPass={n.pass} />
          ))
        )}
      </Section>

      <Section id="decisions" title="Decisions for you" count={data.decisions.length} hint="answer Claude in chat">
        {data.decisions.length === 0 ? (
          <Empty>Nothing to decide.</Empty>
        ) : (
          data.decisions.map((d, i) => (
            <DecisionRow key={d.issue_id} slug={workspaceSlug} item={d} defaultOpen={i === 0} />
          ))
        )}
      </Section>

      <Section
        id="done"
        title="Done since you last looked"
        count={done.length}
        action={
          <>
            <Button
              variant="secondary"
              className="h-8 max-sm:h-11"
              disabled={done.length === 0 || n.seenAllBusy || !n.online}
              onClick={() => void n.seenAll()}
            >
              OK, seen
            </Button>
          </>
        }
      >
        {done.length === 0 ? (
          <Empty>
            Nothing new since <b className="font-medium text-primary">{sinceLabel}</b>.
          </Empty>
        ) : (
          done.map((d) => (
            <DoneRow
              key={d.issue_id}
              slug={workspaceSlug}
              item={d}
              error={n.rowErrors[d.issue_id]}
              onSeen={() => void n.seenOne(d.issue_id, d.at)}
            />
          ))
        )}
        {done.length >= 50 && <Empty>50 shown</Empty>}
        {n.rowErrors.__all && (
          <p role="alert" className="px-3.5 pb-3 text-13 text-danger-primary">
            {n.rowErrors.__all}
          </p>
        )}
      </Section>

      <Section id="running" title="Running" count={data.running.length} hint="Building and In Review">
        {data.running.length === 0 ? (
          <Empty>Nothing running.</Empty>
        ) : (
          data.running.map((r) => <RunningRow key={r.issue_id} slug={workspaceSlug} item={r} />)
        )}
      </Section>

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-5 z-20 flex flex-col items-center gap-2"
      >
        {n.passes.map((p) => (
          <div
            key={p.issueId}
            className="shadow-lg pointer-events-auto flex max-w-full items-center gap-3.5 rounded-xl bg-[#1C2024] py-1.5 pr-1.5 pl-4 text-13 text-white"
          >
            <span>
              {p.key} passed. {p.closes ? "It moves to Done" : "Back to Claude"} in {PASS_UNDO_MS / 1000} s.
            </span>
            <button
              type="button"
              className="min-h-11 px-2 font-semibold text-[#A9C1FF] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              onClick={() => n.undoPass(p.issueId)}
            >
              Undo
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

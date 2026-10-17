/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@plane/propel/button";
import type { TNeedsMeDecision, TNeedsMeDone, TNeedsMeRunning, TNeedsMeTest } from "@/services/needs-me.service";
import { AccordionRow, CardLinks, StateChip, ago, cardHref } from "./accordion-row";
import { ReadOnlyHtml, stepsOnly } from "./read-only-html";
import type { TPendingPass } from "./use-needs-me";

const BTN = "h-8 max-sm:h-11 max-sm:min-w-11";

/** "Your test (iPhone share sheet (Safari), 3 minutes)" -> "iPhone share sheet (Safari)". The minutes come from test_minutes. */
export const whereOf = (heading: string): string => {
  const open = heading.indexOf("(");
  if (open < 0) return "";
  let depth = 0;
  let end = heading.length;
  for (let i = open; i < heading.length; i++) {
    if (heading[i] === "(") depth++;
    else if (heading[i] === ")" && --depth === 0) {
      end = i;
      break;
    }
  }
  return heading
    .slice(open + 1, end)
    .replace(/(^|,)\s*\d+\s*min(ute)?s?\s*$/i, "")
    .trim();
};

function Chips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((w) => (
        <span key={w} className="rounded-sm border border-subtle px-1.5 text-12 text-tertiary">
          {w}
        </span>
      ))}
    </span>
  );
}

export function TestRow(props: {
  slug: string;
  item: TNeedsMeTest;
  error?: string;
  onPass: (p: TPendingPass) => void;
}) {
  const { slug, item, error, onPass } = props;
  const where = whereOf(item.test_heading);
  const chips = [...(where ? [where] : []), ...(item.test_minutes !== null ? [`${item.test_minutes} min`] : [])];
  return (
    <AccordionRow
      cardKey={item.key}
      title={item.name}
      href={cardHref(slug, item.project_id, item.issue_id, item.key)}
      state={item.state}
      summary={<Chips items={chips} />}
      error={error}
    >
      <div className="max-w-[70ch] rounded-lg bg-layer-1 px-3.5 py-3">
        <ReadOnlyHtml
          id={`needs-me-test-${item.issue_id}`}
          html={stepsOnly(item.test_html)}
          workspaceSlug={slug}
          projectId={item.project_id}
        />
      </div>
      <div className="mt-3 flex items-center gap-3 max-sm:flex-col max-sm:items-stretch">
        <span className="flex-1 text-12 text-tertiary">
          {item.closes ? "Pass closes this card (moves it to Done)." : "Pass hands this card back to Claude."}
        </span>
        <Button
          variant="primary"
          className={`${BTN} max-sm:w-full`}
          onClick={() => onPass({ issueId: item.issue_id, key: item.key, closes: item.closes })}
        >
          Pass
        </Button>
      </div>
    </AccordionRow>
  );
}

export function DecisionRow(props: { slug: string; item: TNeedsMeDecision; defaultOpen: boolean }) {
  const { slug, item, defaultOpen } = props;
  const href = cardHref(slug, item.project_id, item.issue_id, item.key);
  const h = "mt-3 mb-1 text-12 font-semibold text-tertiary";
  return (
    <AccordionRow
      cardKey={item.key}
      title={item.name}
      href={href}
      state={item.state}
      when={ago(item.need_at)}
      defaultOpen={defaultOpen}
    >
      <div className="max-w-[74ch]">
        <h4 className={h}>What Claude needs</h4>
        {item.need_html ? (
          <ReadOnlyHtml
            id={`needs-me-need-${item.issue_id}`}
            html={item.need_html}
            workspaceSlug={slug}
            projectId={item.project_id}
          />
        ) : (
          <p className="text-13 text-tertiary">No pending note on this card.</p>
        )}
        {item.about_html && (
          <>
            <h4 className={h}>Why this card exists</h4>
            <ReadOnlyHtml
              id={`needs-me-about-${item.issue_id}`}
              html={item.about_html}
              workspaceSlug={slug}
              projectId={item.project_id}
            />
          </>
        )}
        <Link
          href={href}
          className="mt-3 inline-flex min-h-8 items-center text-13 font-medium text-accent-primary hover:underline max-sm:min-h-11"
        >
          Open {item.key} →
        </Link>
      </div>
    </AccordionRow>
  );
}

function PlainRow(props: { children: ReactNode; error?: string }) {
  return (
    <div className="border-t border-subtle first:border-t-0">
      <div className="relative flex min-h-[48px] flex-wrap items-center gap-x-2.5 gap-y-1 px-3.5 py-2">
        {props.children}
      </div>
      {props.error && (
        <p role="alert" className="px-3.5 pb-2 text-13 text-danger-primary">
          {props.error}
        </p>
      )}
    </div>
  );
}

export function DoneRow(props: { slug: string; item: TNeedsMeDone; error?: string; onSeen: () => void }) {
  const { slug, item, error, onSeen } = props;
  const href = cardHref(slug, item.project_id, item.issue_id, item.key);
  const label = item.state.group === "completed" ? item.state.name : "Live";
  return (
    <PlainRow error={error}>
      <CardLinks href={href} cardKey={item.key} title={item.name}>
        <StateChip state={item.state} label={label} />
      </CardLinks>
      <span className="text-12 whitespace-nowrap text-tertiary">{ago(item.at)}</span>
      <Button variant="secondary" className={BTN} onClick={onSeen} aria-label={`OK, seen: ${item.key}`}>
        OK, seen
      </Button>
    </PlainRow>
  );
}

export function RunningRow(props: { slug: string; item: TNeedsMeRunning }) {
  const { slug, item } = props;
  return (
    <PlainRow>
      <CardLinks href={cardHref(slug, item.project_id, item.issue_id, item.key)} cardKey={item.key} title={item.name}>
        <StateChip state={item.state} />
      </CardLinks>
      <span className="text-12 whitespace-nowrap text-tertiary">{item.assignees.join(", ")}</span>
    </PlainRow>
  );
}

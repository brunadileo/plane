/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useId, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { generateWorkItemLink } from "@plane/utils";
import { cn } from "@plane/utils";
import type { TNeedsMeState } from "@/services/needs-me.service";

const CHIP_BY_STATE: Record<string, string> = {
  "Final Test": "text-[#B4235F] bg-[#FDF0F6]",
  Building: "text-[#9A5B00] bg-[#FEF5E7]",
  "In Review": "text-[#2959C6] bg-[#EEF3FE]",
};

export function StateChip({ state, label }: { state: TNeedsMeState; label?: string }) {
  const tone =
    CHIP_BY_STATE[state.name] ??
    (state.group === "completed" ? "text-[#2A7E3B] bg-[#EEF8F0]" : "text-secondary bg-layer-1");
  return (
    <span className={cn("rounded-sm px-1.5 py-px text-12 font-medium whitespace-nowrap", tone)}>
      {label ?? state.name}
    </span>
  );
}

/** Relative age, "2 days", "20 min". */
export function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** Link to the card, from its key ("READ-420"). */
export const cardHref = (workspaceSlug: string, projectId: string, issueId: string, key: string) => {
  const cut = key.lastIndexOf("-");
  return generateWorkItemLink({
    workspaceSlug,
    projectId,
    issueId,
    projectIdentifier: key.slice(0, cut),
    sequenceId: key.slice(cut + 1),
  });
};

type LinkProps = { href: string; cardKey: string; title: string };

/** Key and title as links. They sit above the stretched toggle, so a tap opens the card. */
export function CardLinks({
  href,
  cardKey,
  title,
  children,
  below,
}: LinkProps & { children?: ReactNode; below?: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-2">
        <Link
          href={href}
          className="relative z-[1] text-12 whitespace-nowrap text-tertiary tabular-nums hover:underline focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none"
        >
          {cardKey}
        </Link>
        {children}
      </span>
      <Link
        href={href}
        className="relative z-[1] mt-0.5 inline-block text-14 font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none"
      >
        {title}
      </Link>
      {below && <span className="mt-1 block text-13 text-tertiary">{below}</span>}
    </span>
  );
}

type Props = {
  cardKey: string;
  title: string;
  href: string;
  state: TNeedsMeState;
  /** small chips or a line under the title, visible while closed */
  summary?: ReactNode;
  when?: string;
  defaultOpen?: boolean;
  error?: string;
  children: ReactNode;
};

/**
 * One closed-by-default accordion row, shared by Tests and Decisions. The toggle is a chevron button
 * stretched over the row head with ::after; the key and title are links above it (no link in a button).
 */
export function AccordionRow({
  cardKey,
  title,
  href,
  state,
  summary,
  when,
  defaultOpen = false,
  error,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className="border-t border-subtle first:border-t-0">
      <div className="relative flex min-h-[52px] items-start gap-2.5 px-3.5 py-3 hover:bg-layer-transparent-hover">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Show details: ${cardKey}`}
          onClick={() => setOpen((o) => !o)}
          className="mt-0.5 flex-shrink-0 text-tertiary after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none"
        >
          <ChevronRight aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-90")} />
        </button>
        <CardLinks href={href} cardKey={cardKey} title={title} below={summary}>
          <StateChip state={state} />
        </CardLinks>
        {when && <span className="text-12 whitespace-nowrap text-tertiary">{when}</span>}
      </div>
      {error && (
        <p role="alert" className="px-3.5 pb-2 pl-10 text-13 text-danger-primary">
          {error}
        </p>
      )}
      <div id={panelId} hidden={!open} className="px-3.5 pb-4 pl-10 max-sm:pl-3.5">
        {open ? children : null}
      </div>
    </div>
  );
}

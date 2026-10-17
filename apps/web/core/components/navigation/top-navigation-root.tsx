/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import { observer } from "mobx-react";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@plane/utils";
import { TopNavPowerK } from "@/components/navigation";
import { HelpMenuRoot } from "@/components/workspace/sidebar/help-section/root";
import { UserMenuRoot } from "@/components/workspace/sidebar/user-menu-root";
import { WorkspaceMenuRoot } from "@/components/workspace/sidebar/workspace-menu-root";
import { useAppRailPreferences } from "@/hooks/use-navigation-preferences";
import { Tooltip } from "@plane/propel/tooltip";
import { AppSidebarItem } from "@/components/sidebar/sidebar-item";
import { InboxIcon } from "@plane/propel/icons";
import useSWR from "swr";
import { needsMeService } from "@/services/needs-me.service";
// local imports
import { StarUsOnGitHubLink } from "@/app/(all)/[workspaceSlug]/(projects)/star-us-link";

export const TopNavigationRoot = observer(function TopNavigationRoot() {
  // router
  const { workspaceSlug } = useParams();
  const pathname = usePathname();

  // store hooks
  const { preferences } = useAppRailPreferences();

  const showLabel = preferences.displayMode === "icon_with_label";

  // Inbox dot: decisions or done-since-you-looked, same data as the Inbox page
  const { data: needsMe } = useSWR(
    workspaceSlug ? `NEEDS_ME_DOT_${workspaceSlug.toString()}` : null,
    workspaceSlug ? () => needsMeService.fetch(workspaceSlug.toString()) : null,
    { refreshInterval: 30000 }
  );
  const hasInboxItems = (needsMe?.decisions.length ?? 0) + (needsMe?.done.length ?? 0) > 0;

  return (
    <div
      className={cn("z-[27] flex min-h-10 w-full items-center bg-canvas px-3.5 transition-all duration-300", {
        "px-2": !showLabel,
      })}
    >
      {/* Workspace Menu */}
      <div className="flex-1 shrink-0">
        <WorkspaceMenuRoot variant="top-navigation" />
      </div>
      {/* Power K Search */}
      <div className="shrink-0">
        <TopNavPowerK />
      </div>
      {/* Additional Actions */}
      <div className="flex flex-1 shrink-0 items-center justify-end gap-1">
        <Tooltip tooltipContent="Inbox" position="bottom">
          <AppSidebarItem
            variant="link"
            item={{
              href: `/${workspaceSlug?.toString()}/needs-me/`,
              icon: (
                <div className="relative">
                  <InboxIcon className="size-5" />
                  {hasInboxItems && <span className="absolute top-0 right-0 size-2 rounded-full bg-danger-primary" />}
                </div>
              ),
              isActive: pathname?.includes("/needs-me"),
            }}
          />
        </Tooltip>
        <HelpMenuRoot />
        <StarUsOnGitHubLink />
        <div className="flex size-8 items-center justify-center rounded-md hover:bg-layer-1-hover">
          <UserMenuRoot />
        </div>
      </div>
    </div>
  );
});

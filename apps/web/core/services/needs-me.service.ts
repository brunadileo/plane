/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type TNeedsMeState = { name: string; group: string; color?: string };

type TCardBase = { issue_id: string; project_id: string; key: string; name: string; state: TNeedsMeState };

export type TNeedsMeTest = TCardBase & {
  test_heading: string;
  test_minutes: number | null;
  test_html: string;
  closes: boolean;
};
export type TNeedsMeDecision = TCardBase & {
  need_html: string | null;
  need_at: string | null;
  about_html: string | null;
};
export type TNeedsMeDone = TCardBase & { at: string; by?: string | null };
export type TNeedsMeRunning = TCardBase & { assignees: string[] };

export type TNeedsMe = {
  generated_at: string;
  seen_at: string | null;
  tests: TNeedsMeTest[];
  decisions: TNeedsMeDecision[];
  done: TNeedsMeDone[];
  running: TNeedsMeRunning[];
};

export class NeedsMeService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async fetch(workspaceSlug: string): Promise<TNeedsMe> {
    const { data } = await this.get(`/api/workspaces/${workspaceSlug}/needs-me/`);
    return data;
  }

  async seenAll(workspaceSlug: string, until: string): Promise<void> {
    await this.post(`/api/workspaces/${workspaceSlug}/needs-me/seen/`, { until });
  }

  async seenOne(workspaceSlug: string, issueId: string, at: string): Promise<void> {
    await this.post(`/api/workspaces/${workspaceSlug}/needs-me/seen/`, { issue_id: issueId, at });
  }

  async pass(workspaceSlug: string, issueId: string): Promise<void> {
    await this.post(`/api/workspaces/${workspaceSlug}/needs-me/pass/`, { issue_id: issueId });
  }
}

export const needsMeService = new NeedsMeService();

# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Inbox page endpoints (NANO-10): what needs the request user, "OK, seen" and "Pass"."""

# Python imports
import html as html_lib
import json
import uuid
from datetime import timedelta

# Django imports
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone
from django.utils.dateparse import parse_datetime

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import IssueCommentSerializer, IssueCreateSerializer
from plane.bgtasks.issue_activities_task import issue_activity
from plane.db.models import (
    Issue,
    IssueActivity,
    IssueAssignee,
    IssueComment,
    Project,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)
from plane.utils.host import base_host
from plane.utils.needs_me import (
    about_html,
    cut_test_block,
    latest_pending_note,
    pass_closes,
    test_minutes,
)

from ..base import BaseAPIView

CLAUDE_EMAIL = "claude@lazyailabs.com"
FINAL_TEST = "Final Test"
RUNNING_STATES = ["Building", "In Review"]
CLOSED_GROUPS = ["completed", "cancelled"]
DONE_LIMIT = 50
SEEN_KEY = "needs_me_seen_at"
SEEN_CARDS_KEY = "needs_me_seen_cards"


def _person(user):
    return (user.first_name or user.display_name or "").strip()


def _state(state):
    return {"name": state.name, "group": state.group, "color": state.color}


def _key(issue):
    return f"{issue.project.identifier}-{issue.sequence_id}"


def _parse_time(value):
    """Aware datetime from an ISO string, or None."""
    if not isinstance(value, str):
        return None
    try:
        parsed = parse_datetime(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed is None:
        return None
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.utc)
    return parsed


def _is_uuid(value):
    try:
        uuid.UUID(str(value))
        return True
    except ValueError:
        return False


def _counted_project_ids(slug, user):
    """Projects where both the request user and Claude are active members."""
    claude_in = ProjectMember.objects.filter(
        workspace__slug=slug,
        project_id=OuterRef("project_id"),
        member__email=CLAUDE_EMAIL,
        is_active=True,
    )
    return list(
        ProjectMember.objects.filter(
            workspace__slug=slug,
            member=user,
            is_active=True,
            project__archived_at__isnull=True,
        )
        .filter(Exists(claude_in))
        .values_list("project_id", flat=True)
    )


def _assigned_to(user):
    return Exists(IssueAssignee.objects.filter(issue_id=OuterRef("pk"), assignee=user))


class NeedsMeEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug):
        user = request.user
        now = timezone.now()
        project_ids = _counted_project_ids(slug, user)

        member = WorkspaceMember.objects.filter(workspace__slug=slug, member=user, is_active=True).first()
        features = (member.explored_features if member else None) or {}
        seen_at = _parse_time(features.get(SEEN_KEY)) or (now - timedelta(days=7))
        seen_cards = features.get(SEEN_CARDS_KEY) or {}

        base = Issue.issue_objects.filter(workspace__slug=slug, project_id__in=project_ids).select_related(
            "state", "project"
        )

        mine = list(base.filter(_assigned_to(user)).exclude(state__group__in=CLOSED_GROUPS).order_by("created_at"))

        notes_by_issue = {}
        for c in IssueComment.objects.filter(
            issue_id__in=[i.id for i in mine], comment_html__contains="Pending on Bruna:"
        ).values("issue_id", "comment_html", "created_at"):
            notes_by_issue.setdefault(c["issue_id"], []).append(c)

        tests, decisions = [], []
        for issue in mine:
            common = {
                "issue_id": str(issue.id),
                "project_id": str(issue.project_id),
                "project_name": issue.project.name,
                "key": _key(issue),
                "name": issue.name,
                "state": _state(issue.state),
            }
            cut = cut_test_block(issue.description_html)
            if cut:
                heading, block, _rest = cut
                tests.append(
                    {
                        **common,
                        "test_heading": heading,
                        "test_minutes": test_minutes(heading),
                        "test_html": block,
                        "closes": issue.state.name == FINAL_TEST and pass_closes(block),
                    }
                )
                continue
            comments = notes_by_issue.get(issue.id, [])
            note = latest_pending_note(comments)
            decisions.append(
                {
                    **common,
                    "need_html": note["comment_html"] if note else None,
                    "need_at": note["created_at"].isoformat() if note else None,
                    "about_html": about_html(issue.description_html),
                }
            )
        tests.sort(key=lambda t: (t["test_minutes"] is None, t["test_minutes"] or 0))  # stable: oldest first

        # Done since the last look: finished cards only (Bruna, 2026-10-17: "just things that finished and
        # don't need me"); Final Test cards wait on her and show under Tests.
        done_state_ids = set(
            State.objects.filter(project_id__in=project_ids, group="completed")
            .values_list("id", flat=True)
        )
        done, seen_issue_ids = [], set()
        activities = (
            IssueActivity.objects.filter(
                workspace__slug=slug,
                project_id__in=project_ids,
                field="state",
                verb="updated",
                created_at__gt=seen_at,
                new_identifier__in=done_state_ids,
            )
            .select_related("actor", "issue", "issue__state", "issue__project")
            .order_by("-created_at")
        )
        for act in activities:
            issue = act.issue
            if issue is None or issue.id in seen_issue_ids:
                continue
            seen_issue_ids.add(issue.id)  # newest qualifying activity per card
            if issue.deleted_at or issue.archived_at or issue.state_id not in done_state_ids:
                continue
            hidden_until = _parse_time(seen_cards.get(str(issue.id)))
            if hidden_until and act.created_at <= hidden_until:
                continue
            done.append(
                {
                    "issue_id": str(issue.id),
                    "project_id": str(issue.project_id),
                    "project_name": issue.project.name,
                    "key": _key(issue),
                    "name": issue.name,
                    "state": _state(issue.state),
                    "at": act.created_at.isoformat(),
                    "by": _person(act.actor) if act.actor else None,
                }
            )
            if len(done) >= DONE_LIMIT:
                break

        # Running
        running = []
        run_qs = (
            base.filter(state__name__in=RUNNING_STATES, issue_assignee__deleted_at__isnull=True)
            .exclude(id__in=[i.id for i in mine])
            .distinct()
            .order_by("-updated_at")
        )
        run_issues = list(run_qs[:DONE_LIMIT])
        names = {}
        for ia in IssueAssignee.objects.filter(issue_id__in=[i.id for i in run_issues]).select_related("assignee"):
            names.setdefault(ia.issue_id, []).append(_person(ia.assignee))
        for issue in run_issues:
            running.append(
                {
                    "issue_id": str(issue.id),
                    "project_id": str(issue.project_id),
                    "project_name": issue.project.name,
                    "key": _key(issue),
                    "name": issue.name,
                    "state": _state(issue.state),
                    "assignees": names.get(issue.id, []),
                }
            )

        return Response(
            {
                "generated_at": now.isoformat(),
                "seen_at": seen_at.isoformat(),
                "tests": tests,
                "decisions": decisions,
                "done": done,
                "running": running,
            },
            status=status.HTTP_200_OK,
        )


class NeedsMeSeenEndpoint(BaseAPIView):
    """Whole list: {"until": generated_at}. One card: {"issue_id", "at"}."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        user = request.user
        data = request.data
        one_card = data.get("issue_id") is not None or data.get("at") is not None

        if one_card:
            at = _parse_time(data.get("at"))
            if at is None:
                return Response({"detail": "at must be a time"}, status=status.HTTP_400_BAD_REQUEST)
            issue_id = str(data.get("issue_id"))
            project_ids = _counted_project_ids(slug, user)
            found = _is_uuid(issue_id) and Issue.issue_objects.filter(
                workspace__slug=slug, project_id__in=project_ids, pk=issue_id
            ).exists()
            if not found:
                return Response({"detail": "not found"}, status=status.HTTP_404_NOT_FOUND)
        else:
            until = _parse_time(data.get("until"))
            if until is None:
                return Response({"detail": "until must be a time"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            member = (
                WorkspaceMember.objects.select_for_update()
                .filter(workspace__slug=slug, member=user, is_active=True)
                .first()
            )
            if member is None:
                return Response({"detail": "not a member"}, status=status.HTTP_403_FORBIDDEN)
            features = dict(member.explored_features or {})
            cards = dict(features.get(SEEN_CARDS_KEY) or {})

            if one_card:
                current = _parse_time(cards.get(issue_id))
                if current is None or at > current:
                    cards[issue_id] = at.isoformat()
                features[SEEN_CARDS_KEY] = cards
                member.explored_features = features
                member.save(update_fields=["explored_features"])
                return Response({"seen_at": features.get(SEEN_KEY), "seen_cards": len(cards)}, status=status.HTTP_200_OK)

            new_seen = min(until, timezone.now())
            stored = _parse_time(features.get(SEEN_KEY))
            if stored is None or new_seen > stored:
                features[SEEN_KEY] = new_seen.isoformat()
                stored = new_seen
            # Per-card entries at or before the cut no longer matter
            features[SEEN_CARDS_KEY] = {
                k: v for k, v in cards.items() if (_parse_time(v) is None) or _parse_time(v) > stored
            }
            member.explored_features = features
            member.save(update_fields=["explored_features"])
            return Response(
                {"seen_at": features[SEEN_KEY], "seen_cards": len(features[SEEN_CARDS_KEY])}, status=status.HTTP_200_OK
            )


class NeedsMePassEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        user = request.user
        issue_id = request.data.get("issue_id")
        if not _is_uuid(issue_id):
            return Response({"detail": "issue_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # caller active member and project not archived; Claude's membership is checked below (EC-2)
        project_ids = ProjectMember.objects.filter(
            workspace__slug=slug, member=user, is_active=True, project__archived_at__isnull=True
        ).values_list("project_id", flat=True)
        with transaction.atomic():
            issue = (
                Issue.issue_objects.select_for_update(of=("self",))
                .select_related("state", "project")
                .filter(workspace__slug=slug, pk=issue_id, project_id__in=project_ids)
                .first()
            )
            if issue is None:
                return Response({"detail": "not found"}, status=status.HTTP_404_NOT_FOUND)

            assigned = IssueAssignee.objects.filter(issue=issue, assignee=user).exists()
            if not assigned or issue.state.group in CLOSED_GROUPS:
                return Response({"detail": "already handled"}, status=status.HTTP_409_CONFLICT)

            cut = cut_test_block(issue.description_html)
            if not cut:
                return Response({"detail": "no test block"}, status=status.HTTP_400_BAD_REQUEST)
            heading, block, _rest = cut

            claude = User.objects.filter(email=CLAUDE_EMAIL).first()
            claude_member = claude is not None and ProjectMember.objects.filter(
                project_id=issue.project_id, member=claude, is_active=True
            ).exists()
            if not claude_member:
                return Response(
                    {"detail": "Claude is not on this project"}, status=status.HTTP_409_CONFLICT
                )

            closes = issue.state.name == FINAL_TEST and pass_closes(block)
            done_state = None
            if closes:
                done_state = State.objects.filter(project_id=issue.project_id, name="Done").first()
                if done_state is None:
                    return Response({"detail": "no Done state"}, status=status.HTTP_409_CONFLICT)

            old_assignees = [
                str(a) for a in IssueAssignee.objects.filter(issue=issue).values_list("assignee_id", flat=True)
            ]
            current_instance = json.dumps(
                {"state_id": str(issue.state_id), "assignee_ids": old_assignees}, cls=DjangoJSONEncoder
            )

            text = (
                f'<p><b>No longer pending:</b> {html_lib.escape(_person(user) or "Bruna")}, via Inbox: '
                f'pass, all steps of "{html_lib.escape(heading)}".'
                + (" Final Test → Done." if closes else "")
                + "</p>"
            )
            comment_ser = IssueCommentSerializer(data={"comment_html": text})
            if not comment_ser.is_valid():
                return Response(comment_ser.errors, status=status.HTTP_400_BAD_REQUEST)
            comment_ser.save(project_id=issue.project_id, issue_id=issue.id, actor=user)
            comment_data = json.dumps(comment_ser.data, cls=DjangoJSONEncoder)

            update = {"assignee_ids": [str(claude.id)]}
            if closes:
                update["state_id"] = str(done_state.id)
            issue_ser = IssueCreateSerializer(
                issue, data=update, partial=True, context={"project_id": issue.project_id}
            )
            if not issue_ser.is_valid():
                transaction.set_rollback(True)
                return Response(issue_ser.errors, status=status.HTTP_400_BAD_REQUEST)
            issue_ser.save()

            origin = base_host(request=request, is_app=True)
            epoch = int(timezone.now().timestamp())
            project_id = str(issue.project_id)
            issue_pk = str(issue.id)
            actor = str(user.id)
            requested = json.dumps(update, cls=DjangoJSONEncoder)
            new_state = done_state or issue.state

            def fire():
                issue_activity.delay(
                    type="comment.activity.created",
                    requested_data=comment_data,
                    actor_id=actor,
                    issue_id=issue_pk,
                    project_id=project_id,
                    current_instance=None,
                    epoch=epoch,
                    notification=True,
                    origin=origin,
                )
                issue_activity.delay(
                    type="issue.activity.updated",
                    requested_data=requested,
                    actor_id=actor,
                    issue_id=issue_pk,
                    project_id=project_id,
                    current_instance=current_instance,
                    epoch=epoch,
                    notification=True,
                    origin=origin,
                )

            transaction.on_commit(fire)

        return Response(
            {
                "issue_id": issue_pk,
                "state": _state(new_state),
                "assignee": _person(claude),
                "closed": closes,
            },
            status=status.HTTP_200_OK,
        )

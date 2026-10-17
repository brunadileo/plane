# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import NeedsMeEndpoint, NeedsMeSeenEndpoint, NeedsMePassEndpoint

urlpatterns = [
    path("workspaces/<str:slug>/needs-me/", NeedsMeEndpoint.as_view(), name="needs-me"),
    path("workspaces/<str:slug>/needs-me/seen/", NeedsMeSeenEndpoint.as_view(), name="needs-me-seen"),
    path("workspaces/<str:slug>/needs-me/pass/", NeedsMePassEndpoint.as_view(), name="needs-me-pass"),
]

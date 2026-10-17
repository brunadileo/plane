# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Pure helpers for the Inbox page (NANO-10). No database, no Django imports.

They read the text conventions written by plane_card.py: a `Your test (` block at the top of a
card description and `Pending on Bruna:` comments.
"""

import html as _html
import re

PENDING_MARKER = "Pending on Bruna:"
PASS_CLOSES_MARKER = "Pass closes this card"

_HEAD_RE = re.compile(r"^\s*(<div>)?\s*<h3>(Your test \(.*?)</h3>", re.S)
_REPLY_RE = re.compile(r"<p>\s*Reply pass.*?</p>", re.S)
_TAG_RE = re.compile(r"<(/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(/?)>")
_VOID = {"hr", "br", "img", "input", "meta", "link", "col", "wbr"}
_MIN_RE = re.compile(r"(\d+)\s*min")


def _text(fragment):
    return _html.unescape(re.sub(r"<[^>]+>", "", fragment)).strip()


def cut_test_block(html):
    """Split a description into (heading, block_html, rest_html), or None when it has no test block.

    The block runs from the `<h3>Your test (` heading to the end of the first `<p>Reply pass...</p>`.
    heading is plain text. rest_html is what follows, without the optional `<div>` wrapper.
    """
    if not html:
        return None
    head = _HEAD_RE.match(html)
    if not head:
        return None
    reply = _REPLY_RE.search(html, head.end())
    if not reply:
        return None
    wrapped = head.group(1) is not None
    start = head.start(2) - len("<h3>")
    block = html[start : reply.end()]
    rest = html[reply.end() :]
    if wrapped:
        rest = re.sub(r"\s*</div>\s*$", "", rest)
    return _text(head.group(2)), block, rest.strip()


def test_minutes(heading):
    """Last `<n> min` in the heading, or None."""
    found = _MIN_RE.findall(heading or "")
    return int(found[-1]) if found else None


def pass_closes(block_html):
    """True when the block says Pass closes the card."""
    return PASS_CLOSES_MARKER in _text(block_html or "")


def latest_pending_note(comments):
    """The newest comment dict containing `Pending on Bruna:`, or None.

    comments: iterable of dicts with `comment_html` and `created_at`.
    """
    best = None
    for c in comments:
        body = c.get("comment_html") or ""
        if PENDING_MARKER not in _text(body):
            continue
        if best is None or c["created_at"] >= best["created_at"]:
            best = c
    return best


def about_html(rest_html, blocks=4):
    """The first `blocks` top-level elements of the html. Empty string for empty input."""
    src = (rest_html or "").strip()
    wrap = re.match(r"^<div>(.*)</div>$", src, re.S)
    if wrap:
        src = wrap.group(1).strip()
    out, depth, start, count = [], 0, None, 0
    for m in _TAG_RE.finditer(src):
        closing, name, selfclose = m.group(1) == "/", m.group(2).lower(), m.group(3) == "/"
        if closing:
            if depth == 0:
                continue
            depth -= 1
            if depth == 0:
                out.append(src[start : m.end()])
                count += 1
        elif name in _VOID or selfclose:
            if depth == 0:
                out.append(src[m.start() : m.end()])
                count += 1
        else:
            if depth == 0:
                start = m.start()
            depth += 1
        if count >= blocks:
            break
    return "".join(out)

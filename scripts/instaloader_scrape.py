#!/usr/bin/env python3
"""Scrape recent Instagram video posts with Instaloader.

Writes a JSON array shaped like Apify's instagram-scraper items, so the app's
existing ranking code can read it unchanged.

Usage:
  instaloader_scrape.py --out FILE [--login USERNAME] [--days 90] [--limit 60] HANDLE [HANDLE ...]

--login loads a saved Instaloader session (create it once with `instaloader -l USERNAME`).
Without a session Instagram blocks most requests quickly.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import instaloader
from instaloader import exceptions as ie


def iso(dt):
    return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def video_item(post, handle):
    def attr(name):
        try:
            return getattr(post, name)
        except Exception:  # some fields trigger extra requests and may fail
            return None

    return {
        "inputUrl": f"https://www.instagram.com/{handle}/",
        "ownerUsername": attr("owner_username") or handle,
        "type": "Video",
        "productType": attr("product_type"),
        "url": f"https://www.instagram.com/p/{post.shortcode}/",
        "timestamp": iso(post.date_utc),
        "videoViewCount": attr("video_view_count"),
        "videoPlayCount": attr("video_play_count"),
        "likesCount": attr("likes"),
        "commentsCount": attr("comments"),
        "videoDuration": attr("video_duration"),
        "videoUrl": attr("video_url"),
        "caption": attr("caption"),
    }


def error_item(handle, code, description):
    return {
        "inputUrl": f"https://www.instagram.com/{handle}/",
        "error": code,
        "errorDescription": description,
    }


def scrape_handle(loader, handle, cutoff, limit):
    try:
        profile = instaloader.Profile.from_username(loader.context, handle)
    except ie.ProfileNotExistsException:
        return [error_item(handle, "not_found", "Profile does not exist")]
    except ie.LoginRequiredException:
        return [error_item(handle, "login_required", "Instagram requires a logged-in session")]
    except ie.ConnectionException as e:
        return [error_item(handle, "fetch_failed", str(e)[:200])]

    if profile.is_private and not profile.followed_by_viewer:
        return [error_item(handle, "private", "Profile is private")]

    items, scanned = [], 0
    try:
        for post in profile.get_posts():
            scanned += 1
            if scanned > limit:
                break
            if post.date_utc < cutoff:
                if getattr(post, "is_pinned", False):
                    continue  # pinned posts can be old; keep looking
                break  # posts are newest first, so the rest are older
            if post.is_video:
                items.append(video_item(post, handle))
    except (ie.LoginRequiredException, ie.ConnectionException, ie.QueryReturnedBadRequestException) as e:
        if not items:
            return [error_item(handle, "fetch_failed", str(e)[:200])]
    return items


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--login")
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--limit", type=int, default=60)
    parser.add_argument("handles", nargs="+")
    args = parser.parse_args()

    loader = instaloader.Instaloader(
        quiet=True,
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        save_metadata=False,
        compress_json=False,
    )
    if args.login:
        try:
            loader.load_session_from_file(args.login)
        except FileNotFoundError:
            print(f"No saved session for {args.login}. Run: instaloader -l {args.login}", file=sys.stderr)
            return 2

    cutoff = datetime.utcnow() - timedelta(days=args.days)
    items = []
    for handle in args.handles:
        found = scrape_handle(loader, handle, cutoff, args.limit)
        items.extend(found)
        print(f"{handle}: {len(found)} item(s)", file=sys.stderr)

    tmp = args.out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(items, f)
    os.replace(tmp, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())

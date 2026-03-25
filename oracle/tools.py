"""
tools.py
--------
External tools:
  - fetch_url(url)        : Fetches raw text content of a web page via requests.
  - langsearch(query)     : Uses LangSearch API to retrieve web snippets for a query.
"""

import os
import requests
from dotenv import load_dotenv
import re

load_dotenv()

LANGSEARCH_API_KEY = os.environ.get("LANGSEARCH_API_KEY", "")
LANGSEARCH_ENDPOINT = "https://api.langsearch.com/v1/web-search"

FETCH_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.google.com/",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


def fetch_url(url: str, timeout: int = 10) -> dict:
    """
    Fetches the text content of a URL using requests.

    Returns:
        {
            "success": bool,
            "url": str,
            "content": str,
            "error": str | None
        }
    """
    session = requests.Session()
    session.headers.update(FETCH_HEADERS)

    try:
        resp = session.get(url, timeout=timeout, allow_redirects=True)
        
        # Explicit status handling (instead of only raise_for_status)
        if resp.status_code >= 400:
            return {
                "success": False,
                "url": url,
                "content": "",
                "error": f"{resp.status_code} Client Error",
            }

        text = resp.text

        # Clean HTML → text
        text = re.sub(r"<(script|style)[^>]*>.*?</(script|style)>", "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()

        return {
            "success": True,
            "url": url,
            "content": text[:4000],
            "error": None,
        }

    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "url": url,
            "content": "",
            "error": str(e),
        }


def langsearch(query: str, count: int = 5) -> dict:
    """
    Uses LangSearch to retrieve web snippets for a given query.
    """
    if not LANGSEARCH_API_KEY:
        return {
            "success": False,
            "query": query,
            "results": [],
            "error": "LANGSEARCH_API_KEY not set in environment.",
        }

    try:
        headers = {
            "Authorization": f"Bearer {LANGSEARCH_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {"query": query, "count": count}

        resp = requests.post(
            LANGSEARCH_ENDPOINT,
            json=payload,
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        results = []
        for item in data.get("results", data.get("webPages", {}).get("value", [])):
            results.append({
                "title": item.get("name", item.get("title", "")),
                "snippet": item.get("snippet", item.get("description", "")),
                "url": item.get("url", ""),
            })

        return {
            "success": True,
            "query": query,
            "results": results,
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "query": query,
            "results": [],
            "error": str(e),
        }
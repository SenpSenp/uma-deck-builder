import json
import urllib.request
from pathlib import Path

from src.config import DATA_DIR


URLS = {
    "umamusume_umas.json": "https://gametora.com/data/umamusume/character-cards.dcce22ed.json",
    "umamusume_cards.json": "https://gametora.com/data/umamusume/support-cards.b703c2cd.json",
    "umamusume_skills.json": "https://gametora.com/data/umamusume/skills.5d6eddd9.json",
}


def download_json(url: str, output_path: Path):
    print(f"[SCRAPER] Baixando {url}")

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json,text/plain,*/*",
            "Referer": "https://gametora.com/",
        },
    )

    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[SCRAPER] Salvo em {output_path}")


def run_all_scrapers():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    for filename, url in URLS.items():
        output_path = DATA_DIR / filename
        download_json(url, output_path)

    print("[SCRAPER] Todos os datasets foram atualizados.")


def main():
    run_all_scrapers()


if __name__ == "__main__":
    main()

import json
from pathlib import Path

from src.loader import load_json
from src.config import DATA_DIR


UMAS_PATH = DATA_DIR / "umamusume_umas.json"
CARDS_PATH = DATA_DIR / "umamusume_cards.json"
SKILLS_PATH = DATA_DIR / "umamusume_skills.json"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DOCS_DATA_DIR = PROJECT_ROOT / "docs" / "data"


def map_rarity(value):
    rarity_map = {
        1: "R",
        2: "SR",
        3: "SSR"
    }

    try:
        return rarity_map.get(int(value))
    except (TypeError, ValueError):
        return None


def build_uma_map():
    umas = load_json(UMAS_PATH)

    uma_map = {}

    for uma in umas:
        url = uma["url_name"]
        code, name = url.split("-", 1)

        uma_map[int(code)] = {
            "name": name,
            "version": uma.get("version")
        }

    return uma_map


def build_card_map():
    cards = load_json(CARDS_PATH)

    card_map = {}

    for card in cards:
        url = card["url_name"]
        code, name = url.split("-", 1)

        event_skills = []
        for sid in card.get("event_skills", []):
            try:
                event_skills.append(int(sid))
            except (TypeError, ValueError):
                continue

        card_map[int(code)] = {
            "name": name,
            "type": card.get("type"),
            "rarity": map_rarity(card.get("rarity")),
            "event_skills": event_skills
        }

    return card_map


def build_event_skill_card_index(card_map):
    event_index = {}

    for card_id, card in card_map.items():
        for skill_id in card.get("event_skills", []):
            if skill_id not in event_index:
                event_index[skill_id] = set()

            event_index[skill_id].add(card_id)

    return event_index


def flatten_sup_hint(sup_hint):
    result = []

    for group in sup_hint:
        if isinstance(group, list):
            result.extend(group)
        else:
            result.append(group)

    return result


def curate_skills():
    skills = load_json(SKILLS_PATH)

    uma_map = build_uma_map()
    card_map = build_card_map()
    event_skill_card_index = build_event_skill_card_index(card_map)

    curated = []

    for skill in skills:
        skill_id = skill.get("id")
        skill_name = skill.get("enname") or skill.get("jpname")
        skill_desc = skill.get("endesc") or skill.get("jpdesc")

        skill_obj = {
            "id": skill_id,
            "name": skill_name,
            "desc": skill_desc,
            "characters": [],
            "support_cards": []
        }

        # Characters
        char_ids = set(skill.get("char", []) + skill.get("char_e", []))

        for cid in char_ids:
            if cid in uma_map:
                uma = uma_map[cid]

                skill_obj["characters"].append({
                    "uma_id": cid,
                    "uma_name": uma["name"],
                    "version": uma["version"]
                })

        # Support cards: sup_hint + event_skills, sem duplicar
        direct_card_ids = set()

        for cid in flatten_sup_hint(skill.get("sup_hint", [])):
            try:
                direct_card_ids.add(int(cid))
            except (TypeError, ValueError):
                continue

        event_card_ids = event_skill_card_index.get(skill_id, set())
        all_card_ids = direct_card_ids | event_card_ids

        for cid in sorted(all_card_ids):
            if cid in card_map:
                card = card_map[cid]

                skill_obj["support_cards"].append({
                    "card_id": cid,
                    "card_name": card["name"],
                    "card_type": card["type"],
                    "card_rarity": card["rarity"]
                })

        curated.append(skill_obj)

    return curated


def save_curated_dataset(skills):
    output_path = DOCS_DATA_DIR / "skills_curated.json"

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(skills, f, ensure_ascii=False, indent=2)

    print(f"Dataset gerado em: {output_path}")


def main():
    skills = curate_skills()

    skills.sort(key=lambda x: x["name"] or "")

    save_curated_dataset(skills)


if __name__ == "__main__":
    main()

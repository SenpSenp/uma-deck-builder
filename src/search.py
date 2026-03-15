def find_characters_with_skills(skills_selected, indexes):

    result = {}
    skill_to_chars = indexes["skill_to_chars"]

    for skill_id in skills_selected:

        chars = skill_to_chars.get(skill_id, [])

        for char in chars:
            result.setdefault(char, []).append(skill_id)

    return result


def find_cards_with_skills(skills_selected, indexes):

    result = {}
    skill_to_cards = indexes["skill_to_cards"]

    for skill_id in skills_selected:

        cards = skill_to_cards.get(skill_id, [])

        for card in cards:
            result.setdefault(card, []).append(skill_id)

    return result
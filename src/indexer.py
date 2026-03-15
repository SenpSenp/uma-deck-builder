def build_indexes(skills):

    skill_to_chars = {}
    skill_to_cards = {}

    char_to_skills = {}
    card_to_skills = {}

    for skill in skills:

        skill_id = skill["id"]

        skill_to_chars[skill_id] = skill["char"]
        skill_to_cards[skill_id] = skill["support_hint"]

        for char in skill["char"]:
            char_to_skills.setdefault(char, []).append(skill_id)

        for card in skill["support_hint"]:
            card_to_skills.setdefault(card, []).append(skill_id)

    return {
        "skill_to_chars": skill_to_chars,
        "skill_to_cards": skill_to_cards,
        "char_to_skills": char_to_skills,
        "card_to_skills": card_to_skills
    }
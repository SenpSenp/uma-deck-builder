function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function buildCharacterKey(char) {
  const umaId = char.uma_id;
  const version = char.version || "default";
  return `${umaId}:${version}`;
}

function buildCharacterBlockKey(char) {
  return [
    char.uma_id,
    normalizeName(char.version || "default"),
  ].join("|");
}

function buildCardBlockKey(card) {
  return [
    normalizeName(card.card_name),
    normalizeName(card.card_rarity),
    normalizeName(card.card_type),
  ].join("|");
}

function getRarityRank(rarity, rarityPriority = ["SSR", "SR", "R"]) {
  const order = new Map(rarityPriority.map((name, index) => [name, index]));
  return order.has(rarity) ? order.get(rarity) : 999;
}

function hasDuplicateCardNames(cards) {
  const seen = new Set();

  for (const card of cards) {
    const name = normalizeName(card.card_name);
    if (!name) continue;
    if (seen.has(name)) return true;
    seen.add(name);
  }

  return false;
}

function compressSimilarCards(cards, rarityPriority) {
  const bestBySignature = new Map();

  for (const card of cards) {
    const signature = JSON.stringify([
      normalizeName(card.card_name),
      [...(card.skills || [])].slice().sort(),
    ]);

    const current = bestBySignature.get(signature);

    if (!current) {
      bestBySignature.set(signature, card);
      continue;
    }

    if (
      getRarityRank(card.card_rarity, rarityPriority) <
      getRarityRank(current.card_rarity, rarityPriority)
    ) {
      bestBySignature.set(signature, card);
    }
  }

  return [...bestBySignature.values()];
}

function computeComboStrength(cards) {
  return cards.reduce((sum, card) => sum + (card.skills?.length || 0), 0);
}

function buildCardPayloads(comboCards) {
  const cardsPayload = [];
  const seenSoFar = new Set();
  const comboSkillSets = comboCards.map((card) => new Set(card.skills || []));

  comboCards.forEach((card, idx) => {
    const currentSkills = new Set(card.skills || []);
    const otherSkills = new Set();

    comboSkillSets.forEach((skillSet, j) => {
      if (j !== idx) {
        skillSet.forEach((skill) => otherSkills.add(skill));
      }
    });

    const newSkills = [...currentSkills].filter((skill) => !seenSoFar.has(skill));
    const sharedSkills = [...currentSkills].filter((skill) => otherSkills.has(skill));

    cardsPayload.push({
      card_id: card.card_id,
      card_name: card.card_name,
      card_type: card.card_type,
      card_rarity: card.card_rarity,
      skills: [...currentSkills].sort(),
      new_skills: newSkills.sort(),
      shared_skills: sharedSkills.sort(),
    });

    currentSkills.forEach((skill) => seenSoFar.add(skill));
  });

  return cardsPayload;
}

function serializeCharacter(character) {
  if (!character) return null;

  return {
    uma_id: character.uma_id,
    uma_name: character.uma_name,
    version: character.version,
    skills: [...(character.skills || [])].sort(),
  };
}

function evaluateWithCharacter(comboCards, character, requestedSkillsOriginal, requestedSkillsSet) {
  const covered = new Set();

  if (character?.skills) {
    character.skills.forEach((skill) => covered.add(skill));
  }

  comboCards.forEach((card) => {
    (card.skills || []).forEach((skill) => covered.add(skill));
  });

  const coveredSkills = requestedSkillsOriginal.filter((skill) => covered.has(skill));
  const missingSkills = requestedSkillsOriginal.filter((skill) => !covered.has(skill));

  return {
    character: serializeCharacter(character),
    cards: buildCardPayloads(comboCards),
    covered_skills: coveredSkills,
    missing_skills: missingSkills,
    coverage_count: coveredSkills.length,
    coverage_ratio: requestedSkillsOriginal.length
      ? coveredSkills.length / requestedSkillsOriginal.length
      : 0,
    cards_used: comboCards.length,
    total_units_used: comboCards.length + (character ? 1 : 0),
    combo_strength: computeComboStrength(comboCards),
  };
}

function pickBestCharacterForCards(comboCards, allCharacters, requestedSkillsOriginal, requestedSkillsSet) {
  const candidates = [null, ...allCharacters];
  let best = null;

  for (const character of candidates) {
    const current = evaluateWithCharacter(
      comboCards,
      character,
      requestedSkillsOriginal,
      requestedSkillsSet
    );

    if (!best) {
      best = current;
      continue;
    }

    const currentKey = [
      -current.coverage_count,
      current.missing_skills.length,
      current.cards_used,
      current.total_units_used,
      -current.combo_strength,
      current.character ? 0 : 1,
    ];

    const bestKey = [
      -best.coverage_count,
      best.missing_skills.length,
      best.cards_used,
      best.total_units_used,
      -best.combo_strength,
      best.character ? 0 : 1,
    ];

    if (JSON.stringify(currentKey) < JSON.stringify(bestKey)) {
      best = current;
    }
  }

  return best;
}

function combinationsOfSize(items, size) {
  const result = [];

  function helper(start, combo) {
    if (combo.length === size) {
      result.push([...combo]);
      return;
    }

    for (let i = start; i < items.length; i += 1) {
      combo.push(items[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }

  helper(0, []);
  return result;
}

export function solveDeck({
  dataset,
  skill_names,
  card_count = 3,
  max_results = 10,
  rarity_priority = ["SSR", "SR", "R"],
  blocked_cards = [],
  blocked_characters = [],
}) {
  const requestedSkillsOriginal = (skill_names || []).filter((name) => String(name).trim());
  const requestedSkillsSet = new Set(requestedSkillsOriginal);
  const wanted = new Set(requestedSkillsOriginal.map(normalizeName));

  const matchedSkills = [];
  const characterPool = new Map();
  const cardPool = new Map();

  for (const skill of dataset || []) {
    const skillNameOriginal = skill.name || "";
    const skillNameNormalized = normalizeName(skillNameOriginal);

    if (!wanted.has(skillNameNormalized)) continue;

    matchedSkills.push({
      id: skill.id,
      name: skillNameOriginal,
      desc: skill.desc || "",
    });

    for (const char of skill.characters || []) {
      const umaId = char.uma_id;
      if (umaId == null) continue;

      const charKey = buildCharacterKey(char);

      if (!characterPool.has(charKey)) {
        characterPool.set(charKey, {
          uma_id: umaId,
          uma_name: char.uma_name || "",
          version: char.version || "",
          skills: new Set(),
        });
      }

      characterPool.get(charKey).skills.add(skillNameOriginal);
    }

    for (const card of skill.support_cards || []) {
      const cardId = card.card_id;
      if (cardId == null) continue;

      if (!cardPool.has(cardId)) {
        cardPool.set(cardId, {
          card_id: cardId,
          card_name: card.card_name || "",
          card_type: card.card_type || "",
          card_rarity: card.card_rarity || "",
          skills: new Set(),
        });
      }

      cardPool.get(cardId).skills.add(skillNameOriginal);
    }
  }

  let allCharacters = [...characterPool.values()].map((char) => ({
    ...char,
    skills: [...char.skills],
  }));

  let allCards = [...cardPool.values()].map((card) => ({
    ...card,
    skills: [...card.skills],
  }));

  const blockedCardKeys = new Set(blocked_cards.map(buildCardBlockKey));
  const blockedCharacterKeys = new Set(blocked_characters.map(buildCharacterBlockKey));

  allCards = allCards.filter((card) => !blockedCardKeys.has(buildCardBlockKey(card)));
  allCharacters = allCharacters.filter(
    (char) => !blockedCharacterKeys.has(buildCharacterBlockKey(char))
  );

  allCards = compressSimilarCards(allCards, rarity_priority);

  allCards.sort((a, b) => {
    const diffSkills = (b.skills?.length || 0) - (a.skills?.length || 0);
    if (diffSkills !== 0) return diffSkills;

    const diffRarity =
      getRarityRank(a.card_rarity, rarity_priority) -
      getRarityRank(b.card_rarity, rarity_priority);
    if (diffRarity !== 0) return diffRarity;

    return (a.card_name || "").localeCompare(b.card_name || "");
  });

  allCards = allCards.slice(0, 20);

  allCharacters.sort((a, b) => {
    const diffSkills = (b.skills?.length || 0) - (a.skills?.length || 0);
    if (diffSkills !== 0) return diffSkills;

    const nameDiff = (a.uma_name || "").localeCompare(b.uma_name || "");
    if (nameDiff !== 0) return nameDiff;

    return (a.version || "").localeCompare(b.version || "");
  });

  allCharacters = allCharacters.slice(0, 15);

  const results = [];
  const maxCardLimit = allCards.length ? Math.max(1, Math.min(card_count, allCards.length)) : 0;

  if (maxCardLimit === 0) {
    results.push(
      pickBestCharacterForCards([], allCharacters, requestedSkillsOriginal, requestedSkillsSet)
    );
  } else {
    for (let currentSize = 1; currentSize <= maxCardLimit; currentSize += 1) {
      for (const combo of combinationsOfSize(allCards, currentSize)) {
        if (hasDuplicateCardNames(combo)) continue;

        const bestResult = pickBestCharacterForCards(
          combo,
          allCharacters,
          requestedSkillsOriginal,
          requestedSkillsSet
        );

        results.push(bestResult);
      }
    }

    results.push(
      pickBestCharacterForCards([], allCharacters, requestedSkillsOriginal, requestedSkillsSet)
    );
  }

  const uniqueResults = [];
  const seen = new Set();

  for (const item of results) {
    const charKey = item.character
      ? `${item.character.uma_id}|${normalizeName(item.character.version || "")}`
      : "none";

    const cardKey = (item.cards || [])
      .map((card) => card.card_id)
      .slice()
      .sort((a, b) => a - b)
      .join(",");

    const resultKey = `${charKey}::${cardKey}`;

    if (seen.has(resultKey)) continue;
    seen.add(resultKey);
    uniqueResults.push(item);
  }

  uniqueResults.sort((a, b) => {
    const keyA = [
      -a.coverage_count,
      a.missing_skills.length,
      a.cards_used,
      a.total_units_used,
      -a.combo_strength,
      a.character ? 0 : 1,
      a.cards.map((card) => card.card_name).join(", "),
    ];

    const keyB = [
      -b.coverage_count,
      b.missing_skills.length,
      b.cards_used,
      b.total_units_used,
      -b.combo_strength,
      b.character ? 0 : 1,
      b.cards.map((card) => card.card_name).join(", "),
    ];

    return JSON.stringify(keyA).localeCompare(JSON.stringify(keyB));
  });

  return {
    requested_skills: requestedSkillsOriginal,
    card_count,
    matched_skills: matchedSkills,
    combinations: uniqueResults.slice(0, max_results),
  };
}

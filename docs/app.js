import { solveDeck } from "./js/deck-solver.js";

const skillsList = document.getElementById("skillsList");
const skillSearch = document.getElementById("skillSearch");
const generateBtn = document.getElementById("generateBtn");
const results = document.getElementById("results");
const selectedSkillsContainer = document.getElementById("selectedSkills");
const selectedCount = document.getElementById("selectedCount");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const cardCountInput = document.getElementById("cardCount");
const rarityPreferenceInput = document.getElementById("rarityPreference");

const blockedCardsContainer = document.getElementById("blockedCards");
const blockedCardsCount = document.getElementById("blockedCardsCount");
const blockedCharactersContainer = document.getElementById("blockedCharacters");
const blockedCharactersCount = document.getElementById("blockedCharactersCount");

const charactersSearchResults = document.getElementById("charactersSearchResults");
const characterSearch = document.getElementById("characterSearch");
const clearCharacterSearchBtn = document.getElementById("clearCharacterSearchBtn");

let allSkills = [];
let selectedSkills = new Set();

let allCharacters = [];
let blockedCards = loadBlockedCards();
let blockedCharacters = loadBlockedCharacters();

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatCharacterText(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCardBlockKey(card) {
  return [
    normalizeText(card.card_name),
    normalizeText(card.card_rarity),
    normalizeText(card.card_type),
  ].join("|");
}

function buildCharacterBlockKey(character) {
  return [
    String(character.uma_id ?? ""),
    normalizeText(character.version || "default"),
  ].join("|");
}

function loadBlockedCards() {
  try {
    const raw = localStorage.getItem("uma_blocked_cards");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBlockedCards() {
  localStorage.setItem("uma_blocked_cards", JSON.stringify(blockedCards));
}

function loadBlockedCharacters() {
  try {
    const raw = localStorage.getItem("uma_blocked_characters");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBlockedCharacters() {
  localStorage.setItem("uma_blocked_characters", JSON.stringify(blockedCharacters));
}

function isCardBlocked(card) {
  const key = buildCardBlockKey(card);
  return blockedCards.some((item) => buildCardBlockKey(item) === key);
}

function isCharacterBlocked(character) {
  const key = buildCharacterBlockKey(character);
  return blockedCharacters.some((item) => buildCharacterBlockKey(item) === key);
}

function addBlockedCard(card) {
  if (!card || isCardBlocked(card)) {
    return;
  }

  blockedCards.push({
    card_name: card.card_name || "",
    card_rarity: card.card_rarity || "",
    card_type: card.card_type || "",
  });

  saveBlockedCards();
  renderBlockedCards();
}

function removeBlockedCardByKey(key) {
  blockedCards = blockedCards.filter((item) => buildCardBlockKey(item) !== key);
  saveBlockedCards();
  renderBlockedCards();
}

function addBlockedCharacter(character) {
  if (!character || isCharacterBlocked(character)) {
    return;
  }

  blockedCharacters.push({
    uma_id: character.uma_id,
    uma_name: character.uma_name || "",
    version: character.version || "",
  });

  saveBlockedCharacters();
  renderBlockedCharacters();
  renderCharactersSearchResults(getFilteredCharacters());
}

function removeBlockedCharacterByKey(key) {
  blockedCharacters = blockedCharacters.filter(
    (item) => buildCharacterBlockKey(item) !== key
  );
  saveBlockedCharacters();
  renderBlockedCharacters();
  renderCharactersSearchResults(getFilteredCharacters());
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function getRarityPriority() {
  const raw = String(rarityPreferenceInput?.value || "SSR,SR,R");
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function getRarityOrder(rarity) {
  const priority = getRarityPriority();
  const index = priority.indexOf(rarity);
  return index >= 0 ? index : 99;
}

async function loadSkills() {
  try {
    const response = await fetch("./data/skills_curated.json");

    if (!response.ok) {
      throw new Error(`Erro ao carregar skills: ${response.status}`);
    }

    const data = await response.json();

    allSkills = Array.isArray(data) ? data : [];
    allCharacters = extractCharactersFromSkills(allSkills);

    renderSkills(allSkills);
    renderSelectedSkills();
    renderBlockedCards();
    renderBlockedCharacters();
    renderCharactersSearchResults([]);
  } catch (error) {
    console.error("Erro em loadSkills:", error);

    skillsList.innerHTML = `
      <div class="empty-state">
        Erro ao carregar skills.
      </div>
    `;

    charactersSearchResults.innerHTML = `
      <div class="empty-state">
        Erro ao carregar personagens.
      </div>
    `;
  }
}

function extractCharactersFromSkills(skills) {
  const byKey = new Map();

  skills.forEach((skill) => {
    const characters = Array.isArray(skill.characters) ? skill.characters : [];

    characters.forEach((character) => {
      const normalized = {
        uma_id: character.uma_id,
        uma_name: character.uma_name || "",
        version: character.version || "",
      };

      const key = buildCharacterBlockKey(normalized);

      if (!byKey.has(key)) {
        byKey.set(key, normalized);
      }
    });
  });

  return [...byKey.values()].sort((a, b) => {
    const labelA = `${formatCharacterText(a.uma_name || "")} ${formatCharacterText(a.version || "")}`.trim();
    const labelB = `${formatCharacterText(b.uma_name || "")} ${formatCharacterText(b.version || "")}`.trim();
    return labelA.localeCompare(labelB);
  });
}

function renderSkills(skills) {
  skillsList.innerHTML = "";

  if (!skills.length) {
    skillsList.innerHTML = `<p class="muted">Nenhuma skill encontrada.</p>`;
    return;
  }

  skills.forEach((skill) => {
    const isChecked = selectedSkills.has(skill.name);

    const label = document.createElement("label");
    label.className = "skill-item";

    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(skill.name)}" ${isChecked ? "checked" : ""} />
      <span class="skill-name">${escapeHtml(skill.name)}</span>
    `;

    const checkbox = label.querySelector("input");

    checkbox.addEventListener("change", (event) => {
      if (event.target.checked) {
        selectedSkills.add(skill.name);
      } else {
        selectedSkills.delete(skill.name);
      }

      renderSelectedSkills();
    });

    skillsList.appendChild(label);
  });
}

function renderSelectedSkills() {
  const selectedArray = [...selectedSkills].sort((a, b) => a.localeCompare(b));
  selectedCount.textContent = String(selectedArray.length);

  if (!selectedArray.length) {
    selectedSkillsContainer.innerHTML = `<span class="muted">Nenhuma skill selecionada.</span>`;
    return;
  }

  selectedSkillsContainer.innerHTML = selectedArray
    .map(
      (skill) => `
        <span class="selected-tag">
          ${escapeHtml(skill)}
          <button type="button" class="tag-remove-btn" data-skill="${escapeHtml(skill)}" aria-label="Remover skill">×</button>
        </span>
      `
    )
    .join("");

  selectedSkillsContainer.querySelectorAll("button[data-skill]").forEach((button) => {
    button.addEventListener("click", () => {
      const skillName = button.getAttribute("data-skill");
      selectedSkills.delete(skillName);

      applyFilterAndRender();
      renderSelectedSkills();
    });
  });
}

function renderBlockedCards() {
  blockedCardsCount.textContent = String(blockedCards.length);

  if (!blockedCards.length) {
    blockedCardsContainer.innerHTML = `<span class="muted">Nenhuma carta bloqueada.</span>`;
    return;
  }

  blockedCardsContainer.innerHTML = blockedCards
    .slice()
    .sort((a, b) => buildCardBlockKey(a).localeCompare(buildCardBlockKey(b)))
    .map((card) => {
      const key = buildCardBlockKey(card);
      const label = `${card.card_name} (${card.card_rarity || "?"} / ${card.card_type || "?"})`;

      return `
        <span class="selected-tag blocked-tag">
          ${escapeHtml(label)}
          <button
            type="button"
            class="tag-remove-btn"
            data-remove-blocked-card="${escapeHtml(key)}"
            aria-label="Remover bloqueio da carta"
            title="Remover bloqueio"
          >
            ×
          </button>
        </span>
      `;
    })
    .join("");

  blockedCardsContainer
    .querySelectorAll("button[data-remove-blocked-card]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        removeBlockedCardByKey(button.getAttribute("data-remove-blocked-card"));
      });
    });
}

function renderBlockedCharacters() {
  blockedCharactersCount.textContent = String(blockedCharacters.length);

  if (!blockedCharacters.length) {
    blockedCharactersContainer.innerHTML = `<span class="muted">Nenhuma personagem bloqueada.</span>`;
    return;
  }

  blockedCharactersContainer.innerHTML = blockedCharacters
    .slice()
    .sort((a, b) => {
      const nameA = `${formatCharacterText(a.uma_name || "")} ${formatCharacterText(a.version || "")}`.trim();
      const nameB = `${formatCharacterText(b.uma_name || "")} ${formatCharacterText(b.version || "")}`.trim();
      return nameA.localeCompare(nameB);
    })
    .map((character) => {
      const key = buildCharacterBlockKey(character);
      const displayName = formatCharacterText(character.uma_name || "");
      const displayVersion = formatCharacterText(character.version || "");
      const label = `${displayName}${displayVersion ? ` (${displayVersion})` : ""}`;

      return `
        <span class="selected-tag blocked-tag">
          ${escapeHtml(label)}
          <button
            type="button"
            class="tag-remove-btn"
            data-remove-blocked-character="${escapeHtml(key)}"
            aria-label="Remover bloqueio da personagem"
            title="Remover bloqueio"
          >
            ×
          </button>
        </span>
      `;
    })
    .join("");

  blockedCharactersContainer
    .querySelectorAll("button[data-remove-blocked-character]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        removeBlockedCharacterByKey(button.getAttribute("data-remove-blocked-character"));
      });
    });
}

function getFilteredCharacters() {
  const term = normalizeText(formatCharacterText(characterSearch?.value || ""));

  if (!term) {
    return [];
  }

  return allCharacters.filter((character) => {
    const name = normalizeText(formatCharacterText(character.uma_name || ""));
    const version = normalizeText(formatCharacterText(character.version || ""));
    const full = `${name} ${version}`.trim();

    return name.includes(term) || version.includes(term) || full.includes(term);
  });
}

function renderCharactersSearchResults(characters) {
  const term = normalizeText(formatCharacterText(characterSearch?.value || ""));

  if (!term) {
    charactersSearchResults.innerHTML = `<p class="muted">Digite para buscar personagens.</p>`;
    return;
  }

  if (!characters.length) {
    charactersSearchResults.innerHTML = `<p class="muted">Nenhuma personagem encontrada.</p>`;
    return;
  }

  charactersSearchResults.innerHTML = characters
    .map((character) => {
      const blocked = isCharacterBlocked(character);
      const displayName = formatCharacterText(character.uma_name || "Sem nome");
      const displayVersion = formatCharacterText(character.version || "");

      return `
        <label class="skill-item">
          <input
            type="checkbox"
            ${blocked ? "checked" : ""}
            data-character-key="${escapeHtml(buildCharacterBlockKey(character))}"
          />
          <span class="skill-name">
            <strong>${escapeHtml(displayName)}</strong>
            ${displayVersion ? `<span class="inline-meta">(${escapeHtml(displayVersion)})</span>` : ""}
          </span>
        </label>
      `;
    })
    .join("");

  charactersSearchResults
    .querySelectorAll("input[data-character-key]")
    .forEach((checkbox, index) => {
      const character = characters[index];

      checkbox.addEventListener("change", (event) => {
        if (event.target.checked) {
          addBlockedCharacter(character);
        } else {
          removeBlockedCharacterByKey(buildCharacterBlockKey(character));
        }
      });
    });
}

function applyFilterAndRender() {
  const term = skillSearch.value.trim().toLowerCase();

  const filtered = allSkills.filter((skill) =>
    (skill.name || "").toLowerCase().includes(term)
  );

  renderSkills(filtered);
}

function getSelectedSkills() {
  return [...selectedSkills];
}

function getCardCount() {
  const rawValue = Number(cardCountInput?.value ?? 3);

  if (Number.isNaN(rawValue)) {
    return 3;
  }

  return Math.max(1, Math.min(6, rawValue));
}

function renderSkillTags(skills, extraClass = "") {
  if (!Array.isArray(skills) || !skills.length) {
    return `<span class="muted">Nenhuma</span>`;
  }

  return skills
    .map(
      (skill) =>
        `<span class="selected-tag result-tag ${extraClass}">${escapeHtml(skill)}</span>`
    )
    .join("");
}

function renderCharacter(character) {
  if (!character) {
    return `
      <div class="character-box">
        <p class="muted">Nenhuma personagem necessária para esta combinação.</p>
      </div>
    `;
  }

  const blocked = isCharacterBlocked(character);
  const umaName = escapeHtml(formatCharacterText(character.uma_name || "Sem nome"));
  const versionValue = formatCharacterText(character.version || "");
  const versionText = versionValue ? ` (${escapeHtml(versionValue)})` : "";
  const skills = Array.isArray(character.skills) ? character.skills : [];

  return `
    <div class="character-box">
      <ul class="result-list">
        <li>
          <strong>
            <button
              type="button"
              class="link-action ${blocked ? "blocked-item" : ""}"
              data-block-character='${escapeHtml(JSON.stringify({
                uma_id: character.uma_id,
                uma_name: character.uma_name || "",
                version: character.version || "",
              }))}'
              title="Clique para bloquear esta personagem nas próximas buscas"
            >
              ${umaName}${versionText}
            </button>
          </strong>
          <br>
          <span>Skills da personagem: ${
            skills.length ? skills.map(escapeHtml).join(", ") : "Nenhuma"
          }</span>
        </li>
      </ul>
    </div>
  `;
}

function renderCardList(cards) {
  if (!Array.isArray(cards) || !cards.length) {
    return `<p class="muted">Nenhuma carta necessária nesta combinação.</p>`;
  }

  const sortedCards = [...cards].sort((a, b) => {
    const rarityDiff = getRarityOrder(a.card_rarity) - getRarityOrder(b.card_rarity);

    if (rarityDiff !== 0) {
      return rarityDiff;
    }

    return (a.card_name || "").localeCompare(b.card_name || "");
  });

  return `
    <ul class="result-list">
      ${sortedCards
        .map((card) => {
          const blocked = isCardBlocked(card);
          const cardName = escapeHtml(card.card_name || "Sem nome");
          const cardType = escapeHtml(card.card_type || "unknown");
          const cardRarity = escapeHtml(card.card_rarity || "");

          return `
            <li>
              <strong>
                <button
                  type="button"
                  class="link-action ${blocked ? "blocked-item" : ""}"
                  data-block-card='${escapeHtml(JSON.stringify({
                    card_name: card.card_name || "",
                    card_rarity: card.card_rarity || "",
                    card_type: card.card_type || "",
                  }))}'
                  title="Clique para bloquear esta carta nas próximas buscas"
                >
                  ${cardName}
                </button>
              </strong>
              <span class="meta-badge">${cardType}</span>
              ${
                card.card_rarity
                  ? `<span class="meta-badge rarity-badge rarity-${card.card_rarity.toLowerCase()}">${cardRarity}</span>`
                  : ""
              }
              <br>
              <span>Skills: ${
                Array.isArray(card.skills) && card.skills.length
                  ? card.skills.map(escapeHtml).join(", ")
                  : "Nenhuma"
              }</span>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function bindResultActions() {
  results.querySelectorAll("[data-block-card]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        const card = JSON.parse(button.getAttribute("data-block-card"));
        addBlockedCard(card);
        button.classList.add("blocked-item");
      } catch (error) {
        console.error("Erro ao bloquear carta:", error);
      }
    });
  });

  results.querySelectorAll("[data-block-character]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        const character = JSON.parse(button.getAttribute("data-block-character"));
        addBlockedCharacter(character);
        button.classList.add("blocked-item");
      } catch (error) {
        console.error("Erro ao bloquear personagem:", error);
      }
    });
  });
}

function renderResults(data) {
  const requestedSkills = Array.isArray(data.requested_skills)
    ? data.requested_skills
    : [];

  const matchedSkills = Array.isArray(data.matched_skills)
    ? data.matched_skills
    : [];

  const combinations = Array.isArray(data.combinations)
    ? data.combinations
    : [];

  const cardCount = Number(data.card_count || getCardCount());

  let html = `
    <div class="result-block">
      <h3>Skills selecionadas</h3>
      ${
        requestedSkills.length
          ? `
            <ul class="result-list">
              ${requestedSkills.map((skill) => `<li>${escapeHtml(skill)}</li>`).join("")}
            </ul>
          `
          : `<p class="muted">Nenhuma skill selecionada.</p>`
      }
    </div>
  `;

  html += `
    <div class="result-block">
      <h3>Configuração da busca</h3>
      <p><strong>Quantidade máxima de cartas:</strong> ${escapeHtml(String(cardCount))}</p>
      <p><strong>Prioridade de raridade:</strong> ${escapeHtml(getRarityPriority().join(" > "))}</p>
    </div>
  `;

  html += `
    <div class="result-block">
      <h3>Skills encontradas no dataset</h3>
      ${
        matchedSkills.length
          ? `
            <ul class="result-list">
              ${matchedSkills
                .map(
                  (skill) => `
                    <li>
                      <strong>${escapeHtml(skill.name || "Sem nome")}</strong>
                      <span class="skill-desc">${escapeHtml(skill.desc || "")}</span>
                    </li>
                  `
                )
                .join("")}
            </ul>
          `
          : `<p class="muted">Nenhuma skill encontrada no dataset.</p>`
      }
    </div>
  `;

  html += `
    <div class="result-block">
      <h3>Melhores combinações</h3>
      ${
        combinations.length
          ? combinations
              .map((combo, index) => {
                const coverageCount = Number(combo.coverage_count || 0);
                const coverageRatio = Number(combo.coverage_ratio || 0);
                const coveredSkills = Array.isArray(combo.covered_skills) ? combo.covered_skills : [];
                const missingSkills = Array.isArray(combo.missing_skills) ? combo.missing_skills : [];
                const comboCards = Array.isArray(combo.cards) ? combo.cards : [];
                const comboCharacter = combo.character || null;

                return `
                  <div class="combo-block">
                    <h4>Combinação #${index + 1}</h4>

                    <p>
                      <strong>Cobertura:</strong>
                      ${coverageCount}/${requestedSkills.length}
                      (${Math.round(coverageRatio * 100)}%)
                    </p>

                    <div class="combo-section">
                      <strong>Skills cobertas:</strong>
                      <div class="result-tags">
                        ${renderSkillTags(coveredSkills)}
                      </div>
                    </div>

                    <div class="combo-section">
                      <strong>Skills faltantes:</strong>
                      <div class="result-tags">
                        ${
                          missingSkills.length
                            ? renderSkillTags(missingSkills, "missing-tag")
                            : `<span class="selected-tag result-tag success-tag">Nenhuma</span>`
                        }
                      </div>
                    </div>

                    <div class="combo-section">
                      <strong>Personagem sugerida:</strong>
                      ${renderCharacter(comboCharacter)}
                    </div>

                    <div class="combo-section">
                      <strong>Deck de cartas:</strong>
                      ${renderCardList(comboCards)}
                    </div>
                  </div>
                `;
              })
              .join("")
          : `<p class="muted">Nenhuma combinação encontrada.</p>`
      }
    </div>
  `;

  results.innerHTML = html;
  bindResultActions();
}

skillSearch.addEventListener("input", () => {
  applyFilterAndRender();
});

clearSelectionBtn.addEventListener("click", () => {
  selectedSkills.clear();
  applyFilterAndRender();
  renderSelectedSkills();
});

characterSearch.addEventListener("input", () => {
  renderCharactersSearchResults(getFilteredCharacters());
});

clearCharacterSearchBtn.addEventListener("click", () => {
  blockedCharacters = [];
  saveBlockedCharacters();
  characterSearch.value = "";
  renderBlockedCharacters();
  renderCharactersSearchResults([]);
});

generateBtn.addEventListener("click", async () => {
  const chosenSkills = getSelectedSkills();
  const cardCount = getCardCount();

  if (!chosenSkills.length) {
    results.innerHTML = `
      <div class="empty-state">
        Selecione pelo menos uma skill.
      </div>
    `;
    return;
  }

  generateBtn.disabled = true;
  results.innerHTML = `<p class="muted">Buscando combinações...</p>`;

  try {
    const payload = {
      skills: chosenSkills,
      card_count: cardCount,
      rarity_priority: getRarityPriority(),
      blocked_cards: blockedCards,
      blocked_characters: blockedCharacters,
    };

    const data = solveDeck({
      dataset: allSkills,
      skill_names: payload.skills,
      card_count: payload.card_count,
      rarity_priority: payload.rarity_priority,
      blocked_cards: payload.blocked_cards,
      blocked_characters: payload.blocked_characters,
    });

    renderResults(data);
  } catch (error) {
    console.error("Erro em generate deck:", error);
    results.innerHTML = `
      <div class="empty-state">
        Erro ao gerar resultado: ${escapeHtml(error.message)}
      </div>
    `;
  } finally {
    generateBtn.disabled = false;
  }
});

renderBlockedCards();
renderBlockedCharacters();
loadSkills();

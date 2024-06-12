export default function enricherSetup() {
  CONFIG.TextEditor.enrichers.push({
    pattern: /@BAB\[(?<uuid>[^\]]+)\]/g,
    enricher: enrichBabonus
  });
}

async function enrichBabonus(config) {
  const uuid = config.groups.uuid;
  const bonus = await babonus.fromUuid(uuid);
  if (!bonus) return;
  const anchor = document.createElement("A");
  anchor.dataset.uuid = uuid;
  anchor.classList.add("babonus", "content-link");
  anchor.innerHTML = `<i class="fa-solid fa-otter"></i>${bonus.name}`;
  anchor.addEventListener("click", () => bonus.toggle());
  return anchor;
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("a.babonus.content-link");
  if (!target) return;
  if (event.detail > 1) event.preventDefault();
  const bonus = await babonus.fromUuid(target.dataset.uuid);
  bonus.toggle();
});

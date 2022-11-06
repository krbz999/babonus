import { MODULE } from "../constants.mjs";

export class BabonusKeysDialog extends Dialog {
  constructor(object, options) {
    super(object, options);
    this.name = options.name;
  }

  get id() {
    return `${MODULE}KeysDialog-${this.name}`;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html[0].addEventListener("click", (event) => {
      const a = event.target.closest("a");
      if (!a) return;

      const index = a.closest("th:nth-child(2)") ? 2 : a.closest("th:nth-child(3)") ? 3 : null;
      if (!index) return;
      const body = a.closest("table").querySelector("tbody");
      const boxSelect = `tr td:nth-child(${index}) input[type='checkbox']`;
      const boxes = body.querySelectorAll(boxSelect);
      const checked = boxes[0].checked;
      boxes.forEach(box => box.checked = !checked);
    });
  }
}

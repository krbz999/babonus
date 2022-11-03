import { MODULE } from "./constants.mjs";

export class BabonusKeysDialog extends Dialog {
  constructor(obj, options) {
    super(obj, options);
    this.object = obj.object;
    this.type = obj.type;
  }

  get id() {
    return `${MODULE}-keys-dialog-${this.object.id}-${this.type}`;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html[0].addEventListener("click", (event) => {
      const a = event.target.closest("a");
      if (!a) return;

      const index = a.dataset.index;
      const body = a.closest("table").querySelector("tbody");
      const boxSelect = `tr td:nth-child(${index}) input[type='checkbox']`;
      const boxes = body.querySelectorAll(boxSelect);
      const checked = boxes[0].checked;
      boxes.forEach(box => box.checked = !checked);
    });
  }
}

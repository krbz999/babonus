export class BonusesField extends foundry.data.fields.SchemaField {
  constructor(fields, options = {}) {
    super(fields, options);
  }

  _validateType(data, options = {}) {
    super._validateType(data, options);
    const isE = foundry.utils.isEmpty(data);
    if (isE) throw new foundry.data.fields.ModelValidationError("may not be an empty object.");
    else return true;
  }

  // delete invalid fields.
  _cleanType(data, options = {}) {
    super._cleanType(data, options);
    const clone = foundry.utils.deepClone(data);
    Object.keys(clone).filter(k => {
      return ["", "0", undefined, null].includes(clone[k].trim());
    }).forEach(k => delete clone[k]);
    return clone;
  }
}

export class FiltersField extends foundry.data.fields.SchemaField {
  constructor(fields, options = {}) {
    super(fields, options);
  }

  // remove null and undefined from arrays and sets,
  // then delete empty sets and arrays.
  _cleanType(data, options = {}) {
    super._cleanType(data, options);
    const clone = foundry.utils.deepClone(data);
    Object.keys(clone).forEach(k => {
      const t = foundry.utils.getType(clone[k]);
      if (t === "Set") {
        clone[k].delete(null);
        clone[k].delete(undefined);
      } else if (t === "Array") {
        clone[k] = clone[k].filter(v => ![null, undefined].includes(v));
      }
    })
    Object.keys(clone).filter(k => {
      return !clone[k] || foundry.utils.isEmpty(clone[k]);
    }).forEach(k => delete clone[k]);
    return clone;
  }
}

export class SpellComponentsField extends foundry.data.fields.SchemaField {
  constructor(fields, options = {}) {
    super(fields, options);
  }

  // if 'types' is empty, delete both it and 'match'.
  _cleanType(data, options = {}) {
    super._cleanType(data, options);
    const clone = foundry.utils.deepClone(data);
    clone["types"] = clone["types"].filter(v => ![null, undefined].includes(v));
    if (foundry.utils.isEmpty(clone["types"])) {
      delete clone["match"];
      delete clone["types"];
    }
    return clone;
  }
}

/**
 * SchemaField containing only Sets that may not overlap.
 */
export class WeaponPropertiesField extends foundry.data.fields.SchemaField {
  constructor(fields, options = {}) {
    super(fields, options);
  }

  // if the sets overlap, error.
  _validateType(data, options = {}) {
    super._validateType(data, options);
    if (data.needed.intersection(data.unfit).size > 0){
      throw new foundry.data.fields.ModelValidationError("may not intersect.");
    } else return true;
  }

  // if either set is empty, delete it.
  _cleanType(data, options = {}) {
    super._cleanType(data, options);
    const clone = foundry.utils.deepClone(data);
    for(const k of Object.keys(data)){
      clone[k] = clone[k].filter(v => ![null, undefined].includes(v));
      if (foundry.utils.isEmpty(clone[k])) delete clone[k];
    }
    return clone;
  }
}

export class RollDataField extends foundry.data.fields.StringField {
  constructor(options = {}) {
    super(options);
  }

  _validateType(value) {
    super._validateType(value);
    const v = Roll.validate(value);
    if (!v) throw new foundry.data.fields.ModelValidationError("cannot validate bonus.");
    else return true;
  }
}

export class AuraField extends foundry.data.fields.SchemaField {
  constructor(fields, options = {}) {
    super(fields, options);
  }

  _cleanType(data, options = {}) {
    super._cleanType(data, options);
    if (data.isTemplate) {
      delete data["blockers"];
      delete data["range"];
    }
    return data;
  }
}

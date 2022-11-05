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
      return clone[k]===undefined || foundry.utils.isEmpty(clone[k]);
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
    if (data.needed.intersection(data.unfit).size > 0) {
      throw new foundry.data.fields.ModelValidationError("may not intersect.");
    } else return true;
  }

  // if either set is empty, delete it.
  _cleanType(data, options = {}) {
    super._cleanType(data, options);
    const clone = foundry.utils.deepClone(data);
    for (const k of Object.keys(data)) {
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

/**
 * DataField for inputs of type 'text' that converts strings
 * separated by semicolons to Arrays. All entries must be an
 * element of the set of choices, with zero duplicates or empty strings.
 */
export class SplitStringField extends foundry.data.fields.DataField {
  constructor(options = {}) {
    super(options);
  }

  _cast(value) {
    console.log("--------------- CAST ---------------");
    if (typeof value === "string") return value.split(";");
    return value;
  }

  _cleanType(value, options = {}) {
    console.log("--------------- CLEAN TYPE ---------------");
    value = super._cleanType(value, options);
    if (typeof value === "string") value = value.split(";");
    if (value instanceof Array) value = value.map(v => v.trim());
    return value;
  }

  validate(value, options = {}) {
    console.log("--------------- VALIDATE ---------------");

    // undefined is fine.
    if (value === undefined) return undefined;

    // strings are fine if they can be split into an array where each element is in choices.
    if (typeof value === "string") {
      const valid = value.split(";").every(v => {
        return this.options.choices.includes(v.trim());
      });
      if (!valid) return new foundry.data.fields.ModelValidationError("INVALID VALUE(S)");
      else return undefined;
    }

    // arrays are fine if they are a subset of choices.
    if (value instanceof Array) {
      // cannot be empty array.
      if (!value.length) return new foundry.data.fields.ModelValidationError("ZERO LENGTH ARRAY!");
      // every element must be a valid choice.
      const valid = value.every(v => {
        return this.options.choices.includes(v);
      });
      if (!valid) return new foundry.data.fields.ModelValidationError("INVALID VALUE(S)");
      // there cannot be duplicates.
      const dupes = value.length > new Set(value).size;
      if(dupes) return new foundry.data.fields.ModelValidationError("HAS DUPES");

      else return undefined;
    }

    console.log("VALUE IS NOT A STRING OR ARRAY:", value);

    return new foundry.data.fields.ModelValidationError("INVALID VALUE.");
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

export class NonEmptySchemaField extends foundry.data.fields.SchemaField {
  constructor(fields, options = {}) {
    super(fields, options);
  }

  _validateType(data, options = {}) {
    super._validateType(data, options);
    const isE = foundry.utils.isEmpty(data);
    if (isE) throw new foundry.data.fields.ModelValidationError("Cannot be an empty object.");
    else return true;
  }

  _cleanType(data, options = {}) {
    super._cleanType(data, options);
    for (const [k, v] of Object.entries(data)) {
      if (!v) delete data[k];
    }
    return data;
  }
}

export class RollDataField extends foundry.data.fields.StringField {
  constructor(options = {}) {
    super(options);
  }

  _validateType(value) {
    super._validateType(value);
    const v = Roll.validate(value);
    if (!v) throw new foundry.data.fields.ModelValidationError("Cannot validate bonus.");
    else return true;
  }
}

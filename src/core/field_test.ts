// Ported from pocketbase/core/field_test.go

import { expect } from "bun:test";
import { ValidationErrors } from "../internal/compat/validation.ts";
import { newTestApp } from "../tests/app.ts";
import { NewBaseCollection } from "./collection.ts";
import { Fields } from "./field.ts";

export function testFieldBaseMethods(fieldType: string): void {
  const factory = Fields[fieldType];
  if (!factory) {
    throw new Error(`Missing ${fieldType} field factory`);
  }
  expect(factory).toBeTruthy();

  const field = factory();
  expect(field).toBeTruthy();

  expect(field.Type()).toBe(fieldType);

  for (const expected of ["new_id", ""]) {
    field.SetId(expected);
    expect(field.GetId()).toBe(expected);
  }

  for (const expected of ["new_name", ""]) {
    field.SetName(expected);
    expect(field.GetName()).toBe(expected);
  }

  for (const expected of [false, true]) {
    field.SetSystem(expected);
    expect(field.GetSystem()).toBe(expected);
  }

  for (const expected of [false, true]) {
    field.SetHidden(expected);
    expect(field.GetHidden()).toBe(expected);
  }
}

export async function testDefaultFieldIdValidation(fieldType: string): Promise<void> {
  const { app, cleanup } = await newTestApp();
  try {
    const collection = NewBaseCollection("test_collection");

    const scenarios = [
      {
        name: "empty value",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          return factory();
        },
        expectError: true,
      },
      {
        name: "invalid length",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetId("a".repeat(101));
          return field;
        },
        expectError: true,
      },
      {
        name: "valid length",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetId("a".repeat(100));
          return field;
        },
        expectError: false,
      },
    ];

    for (const scenario of scenarios) {
      const errors = scenario.build().ValidateSettings(null, app, collection);
      const validation = errors instanceof ValidationErrors ? errors.errors : {};
      const hasErr = Boolean(validation.id);
      expect(hasErr).toBe(scenario.expectError);
    }
  } finally {
    await cleanup();
  }
}

export async function testDefaultFieldNameValidation(fieldType: string): Promise<void> {
  const { app, cleanup } = await newTestApp();
  try {
    const collection = NewBaseCollection("test_collection");

    const scenarios = [
      {
        name: "empty value",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          return factory();
        },
        expectError: true,
      },
      {
        name: "invalid length",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetName("a".repeat(101));
          return field;
        },
        expectError: true,
      },
      {
        name: "valid length",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetName("a".repeat(100));
          return field;
        },
        expectError: false,
      },
      {
        name: "invalid regex",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetName("test(");
          return field;
        },
        expectError: true,
      },
      {
        name: "valid regex",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetName("test_123");
          return field;
        },
        expectError: false,
      },
      {
        name: "_via_",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetName("a_via_b");
          return field;
        },
        expectError: true,
      },
      {
        name: "system reserved - null",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetName("null");
          return field;
        },
        expectError: true,
      },
      {
        name: "system reserved - false",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetName("false");
          return field;
        },
        expectError: true,
      },
      {
        name: "system reserved - true",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetName("true");
          return field;
        },
        expectError: true,
      },
      {
        name: "system reserved - _rowid_",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetName("_rowid_");
          return field;
        },
        expectError: true,
      },
      {
        name: "system reserved - expand",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetName("expand");
          return field;
        },
        expectError: true,
      },
      {
        name: "system reserved - collectionId",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetName("collectionId");
          return field;
        },
        expectError: true,
      },
      {
        name: "system reserved - collectionName",
        build: () => {
          const factory = Fields[fieldType];
          if (!factory) {
            throw new Error(`Missing ${fieldType} field factory`);
          }
          const field = factory();
          field.SetName("collectionName");
          return field;
        },
        expectError: true,
      },
    ];

    for (const scenario of scenarios) {
      const errors = scenario.build().ValidateSettings(null, app, collection);
      const validation = errors instanceof ValidationErrors ? errors.errors : {};
      const hasErr = Boolean(validation.name);
      expect(hasErr).toBe(scenario.expectError);
    }
  } finally {
    await cleanup();
  }
}

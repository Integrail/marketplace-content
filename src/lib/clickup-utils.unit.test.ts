import assert from "node:assert/strict";
import { getField, getDropDownValue, getLabelNames } from "./clickup-utils.js";
import type { ClickUpCustomField, ClickUpTaskSummary } from "./clickup-utils.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTask(fields: ClickUpCustomField[]): ClickUpTaskSummary {
    return {
        id: "abc123",
        custom_id: "MW-0001",
        name: "Test Task",
        markdown_description: "",
        date_updated: "1000000000000",
        tags: [],
        custom_fields: fields,
    };
}

const DROP_DOWN_FIELD: ClickUpCustomField = {
    id: "field-1",
    name: "ITEM_TYPE",
    type: "drop_down",
    type_config: {
        options: [
            { id: "opt-0", name: "Worker",   color: "#f00", orderindex: 0 },
            { id: "opt-1", name: "Workflow", color: "#0f0", orderindex: 1 },
            { id: "opt-2", name: "Skill",    color: "#00f", orderindex: 2 },
        ],
    },
    value: 1,
    required: false,
};

const LABELS_FIELD: ClickUpCustomField = {
    id: "field-2",
    name: "ITEM_APPS",
    type: "labels",
    type_config: {
        options: [
            { id: "app-a", label: "GMail",      color: "#f00", orderindex: 0 },
            { id: "app-b", label: "NetSuite",   color: "#0f0", orderindex: 1 },
            { id: "app-c", label: "QuickBooks", color: "#00f", orderindex: 2 },
        ],
    },
    value: ["app-c", "app-a"],
    required: false,
};

// ── getField ──────────────────────────────────────────────────────────────────

describe("getField", () => {
    it("returns the field matching the given name", () => {
        const task = makeTask([DROP_DOWN_FIELD, LABELS_FIELD]);
        assert.equal(getField(task, "ITEM_TYPE"), DROP_DOWN_FIELD);
        assert.equal(getField(task, "ITEM_APPS"), LABELS_FIELD);
    });

    it("returns undefined when no field has that name", () => {
        const task = makeTask([DROP_DOWN_FIELD]);
        assert.equal(getField(task, "NONEXISTENT"), undefined);
    });

    it("returns undefined for an empty custom_fields array", () => {
        const task = makeTask([]);
        assert.equal(getField(task, "ITEM_TYPE"), undefined);
    });
});

// ── getDropDownValue ──────────────────────────────────────────────────────────

describe("getDropDownValue", () => {
    it("returns the option name matching the selected orderindex", () => {
        assert.equal(getDropDownValue({ ...DROP_DOWN_FIELD, value: 0 }), "Worker");
        assert.equal(getDropDownValue({ ...DROP_DOWN_FIELD, value: 1 }), "Workflow");
        assert.equal(getDropDownValue({ ...DROP_DOWN_FIELD, value: 2 }), "Skill");
    });

    it("returns undefined when value is null", () => {
        assert.equal(getDropDownValue({ ...DROP_DOWN_FIELD, value: null }), undefined);
    });

    it("returns undefined when value is undefined", () => {
        assert.equal(getDropDownValue({ ...DROP_DOWN_FIELD, value: undefined }), undefined);
    });

    it("returns undefined when value does not match any orderindex", () => {
        assert.equal(getDropDownValue({ ...DROP_DOWN_FIELD, value: 99 }), undefined);
    });

    it("returns undefined for a non-drop_down field type", () => {
        assert.equal(getDropDownValue(LABELS_FIELD), undefined);
    });
});

// ── getLabelNames ─────────────────────────────────────────────────────────────

describe("getLabelNames", () => {
    it("returns display names in the order the IDs appear in value", () => {
        assert.deepEqual(getLabelNames(LABELS_FIELD), ["QuickBooks", "GMail"]);
    });

    it("returns an empty array when value is an empty array", () => {
        assert.deepEqual(getLabelNames({ ...LABELS_FIELD, value: [] }), []);
    });

    it("returns an empty array when value is undefined", () => {
        assert.deepEqual(getLabelNames({ ...LABELS_FIELD, value: undefined }), []);
    });

    it("silently skips IDs that don't match any option", () => {
        assert.deepEqual(
            getLabelNames({ ...LABELS_FIELD, value: ["app-b", "unknown-id"] }),
            ["NetSuite"],
        );
    });

    it("returns an empty array for a non-labels field type", () => {
        assert.deepEqual(getLabelNames(DROP_DOWN_FIELD), []);
    });

    it("falls back to option.name when option.label is absent", () => {
        const field: ClickUpCustomField = {
            ...LABELS_FIELD,
            type_config: {
                options: [{ id: "x", name: "FallbackName", color: "#000", orderindex: 0 }],
            },
            value: ["x"],
        };
        assert.deepEqual(getLabelNames(field), ["FallbackName"]);
    });
});

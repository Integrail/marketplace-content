export type ClickUpCustomField = {
    id: string;
    name: string;
    type: string;
    type_config: {
        options?: Array<{
            id: string;
            name?: string;
            label?: string;
            color: string;
            orderindex: number;
        }>;
        [key: string]: unknown;
    };
    value?: unknown;
    required: boolean | null;
};

export type ClickUpTaskSummary = {
    id: string;
    custom_id: string;
    name: string;
    markdown_description: string;
    date_updated: string;
    tags: Array<{ name: string }>;
    custom_fields: ClickUpCustomField[];
};

export function getField(task: ClickUpTaskSummary, fieldName: string): ClickUpCustomField | undefined {
    return task.custom_fields.find(f => f.name === fieldName);
}

/** Resolves the selected option name for a `drop_down` field. */
export function getDropDownValue(field: ClickUpCustomField): string | undefined {
    if (field.type !== "drop_down") return undefined;
    const orderindex = field.value as number | undefined | null;
    if (orderindex === undefined || orderindex === null) return undefined;
    return field.type_config.options?.find(o => o.orderindex === orderindex)?.name;
}

/** Returns the display names of all selected options for a `labels` field. */
export function getLabelNames(field: ClickUpCustomField): string[] {
    if (field.type !== "labels") return [];
    const selectedIds = (field.value as string[] | undefined) ?? [];
    const options = field.type_config.options ?? [];
    return selectedIds
        .map(id => options.find(o => o.id === id))
        .filter((o): o is NonNullable<typeof o> => o !== undefined)
        .map(o => (o.label ?? o.name ?? "").trim())
        .filter(Boolean);
}

import { InvalidOptionArgumentError } from "commander";

export function parseNonEmptyString(value: string | undefined): string {
    if (value == null || value.trim() === "") {
        throw new InvalidOptionArgumentError("must be a non-empty string");
    }
    return value.trim();
}

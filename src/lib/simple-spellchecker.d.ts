declare module "simple-spellchecker" {
    interface Dictionary {
        isMisspelled(word: string): boolean;
        spellCheck(word: string): boolean;
        getSuggestions(word: string, limit?: number, maxDistance?: number): string[];
    }

    const SpellChecker: {
        getDictionarySync(fileName: string, folderPath?: string): Dictionary;
        getDictionary(fileName: string, callback: (err: string | null, dict: Dictionary) => void): void;
        getDictionary(fileName: string, folderPath: string, callback: (err: string | null, dict: Dictionary) => void): void;
    };
    export = SpellChecker;
}

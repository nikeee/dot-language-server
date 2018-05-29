// The settings interface describe the server relevant settings part
export interface Settings {
	dotLanguageServer: DotLanguageServerSettings;
}

// These are the example settings we defined in the client's package.json file
export interface DotLanguageServerSettings {
	maxNumberOfProblems: number;
}

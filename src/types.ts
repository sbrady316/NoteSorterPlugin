/**
 * Settings for the Note Sorter Plugin
 */
export interface NoteSorterPluginSettings {
	mySetting: string;
}

/**
 * Sort data for canvas nodes
 */
export interface SortData {
	length: number;
	quadrant: number;
}

export const DEFAULT_SETTINGS: NoteSorterPluginSettings = {
	mySetting: 'default'
};

export const NoteSorterViewType = 'note-sorter-view';

import { App, Editor, MarkdownView, Menu, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

// Remember to rename these classes and interfaces!

interface NoteSorterPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: NoteSorterPluginSettings = {
	mySetting: 'default'
}

export default class NoteSorterPlugin extends Plugin {
	settings: NoteSorterPluginSettings;

	async onload() {
		await this.loadSettings();

		// Add a file menu item
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				// Only add the menu item for .canvas files
				if (file.name.endsWith('.canvas')) {
					menu.addItem((item) => {
					item
						.setTitle('Export note sort data')
						.setIcon('file-down')
						.onClick(async () => {
							this.exportSortData(file.path);
						});
					});
				}
			})
		);

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	exportSortData(filePath: string) {
		const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
		if (!file) {
			return;
		}

		const targetFilePath = filePath.replace(/\.canvas$/, '_sortdata.json');

		console.log(`Exporting sort data for file: ${file.path} to ${targetFilePath}` );
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: NoteSorterPlugin;

	constructor(app: App, plugin: NoteSorterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}

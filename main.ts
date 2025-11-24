import {
	App,
	BasesView,
	BasesQueryResult,
	Editor, 
	MarkdownView, 
	Menu, 
	moment,
	Plugin,
	PluginSettingTab,
	QueryController,
	Setting,
	TFile
} from 'obsidian';
import { CanvasData, CanvasFileData, CanvasNodeData } from 'obsidian/canvas';

// Remember to rename these classes and interfaces!

interface NoteSorterPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: NoteSorterPluginSettings = {
	mySetting: 'default'
}

interface SortData {
	length: number;
	quadrant: number;
}

export const NoteSorterViewType = 'note-sorter-view';

export default class NoteSorterPlugin extends Plugin {
	settings: NoteSorterPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerBasesView(NoteSorterViewType, {
			name: 'Note Sorter',
			icon: 'hand-metal',
			factory: (controller, containerEl) => {
				return new NoteSorterBasesView(controller, containerEl)
			},
			options: () => ([
				{
					key: 'TargetCanvas',
					type: 'file', 
					displayName: 'Linked Canvas',
					description: 'The canvas file to sync with',
					defaultValue: ''},
			]),
		});

		this.addRibbonIcon('info', 'Print leaf types', () => {
			console.log('Printing leaf types:');
			this.app.workspace.iterateRootLeaves((leaf) => {
				// Can get data from canvas view, but not bases
				// Crap - how do I see the data inside the canvas view? This would be instead of reading the file.
				// Not sure if I can update, eg add nodes - what does the folder plugin do?
				console.log(leaf.getViewState().type, leaf.view, leaf.getViewState());

				if (leaf.getViewState().type === 'canvas') {
					// This doesn't work consistently - canvas is undefined
					// It seems to be related to if the canvas is the currently active file
					// The plugin I'm following just interacts with the file in other parts of the code
					console.log('Extended interrogation for canvas view:', leaf.getViewState().type);


					// @ts-ignore
					const canvas = leaf.view.canvas;
					const canvasData = canvas?.getData();
					// canvasData.setData(canvasData);

					console.log('Canvas from view:', canvas);
					console.log('Canvas data from view:', canvasData);
				}
			});
		});

		this.addRibbonIcon('hand-metal', 'Log Sort Data', () => {
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile && activeFile.name.endsWith('.canvas')) {
				this.exportSortData(activeFile.path, false);
			}
		});


		this.addRibbonIcon('refresh-ccw', 'Sync Canvas to Files', () => {
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile && activeFile.name.endsWith('.canvas')) {
				this.exportSortData(activeFile.path, true);
			}
		});

		// Add a file menu item
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				// Only add the menu item for .canvas files
				if (file.name.endsWith('.canvas')) {
					menu.addItem((item) => {
						item
							.setTitle('Sync Canvas to Files')
							.setIcon('refresh-ccw')
							.onClick(async () => {
								await this.exportSortData(file.path);
							});
					});
				}
			})
		);

		// Add an editor menu item
		this.registerEvent(
			// TS-ignore because canvas:selection-menu is not in the Obsidian API typings yet
			// @ts-ignore
			this.app.workspace.on("canvas:selection-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
				const file = view?.file;
				console.log("Editor menu triggered");
				console.log(editor);
				console.log(view);
				if (!file) {
					console.log("No file associated with the current view.");
					return;
				}
				// Only add the menu item for .canvas files
				if (file.name.endsWith('.canvas')) {
					menu.addItem((item) => {
						item
							.setTitle('Sync Canvas to Files')
							.setIcon('refresh-ccw')
							.onClick(async () => {
								await this.exportSortData(file.path);
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

	async exportSortData(filePath: string, updateFiles: boolean = true) {
		const file = this.app.vault.getFileByPath(filePath);
		if (!file) {
			return;
		}

		const canvasContent = await this.app.vault.cachedRead(file);
		const canvasData: CanvasData = JSON.parse(canvasContent);

		// Find the center node or default to (0,0)
		const centerNode: CanvasNodeData =
			canvasData.nodes.find(node => node.file?.endsWith('ns-center.svg'))
			?? { x: 0, width: 0, y: 0, height: 0 } as CanvasNodeData;
		if (centerNode) {
			console.log(`Center node found: id=${centerNode.id}, x=${centerNode.x}, y=${centerNode.y}`);
		}

		const targetNodes: CanvasFileData[] = canvasData.nodes.filter(
			node => node.type === 'file' && (node as CanvasFileData)?.file.endsWith('.md')) as CanvasFileData[];

		const sortData = this.getSortData(targetNodes, centerNode);
		targetNodes.forEach(fileNode => {
			console.log(`File node: id=${fileNode.id}, file=${fileNode.file}, x=${fileNode.x}, y=${fileNode.y} --> quadrant: ${sortData[fileNode.id].quadrant}, dist: ${sortData[fileNode.id].length}`);

			const fileNodeFile = this.app.vault.getFileByPath(fileNode.file);
			if (!fileNodeFile) {
				console.log(`File not found in vault: ${fileNode.file}`);
				return;
			}

			if (updateFiles) {
				this.app.fileManager.processFrontMatter(fileNodeFile, (frontMatter) => {
					frontMatter['ns-distance'] = sortData[fileNode.id].length;
					frontMatter['ns-priority'] = sortData[fileNode.id].quadrant;
				});
			}
		});
	}

	getSortData(nodes: CanvasNodeData[], centerNode: CanvasNodeData): Record<string, SortData> {

		let sortData: Record<string, SortData> = {};

		let maxLength = 0;
		nodes.forEach(node => {
			const deltaX = (node.x + node.width / 2) - (centerNode.x + centerNode.width / 2);
			const deltaY = (node.y + node.height / 2) - (centerNode.y + centerNode.height / 2);
			sortData[node.id] = { length: Math.hypot(deltaX, deltaY), quadrant: this.getQuadrant(deltaX, deltaY) };

			if (sortData[node.id].length > maxLength) {
				maxLength = sortData[node.id].length;
			}
		});

		// Normalize lengths to be 0 - 1 with 3 decimal places
		nodes.forEach(node => {
			sortData[node.id].length = Math.round(sortData[node.id].length * 1000 / maxLength) / 1000;
		});

		return sortData;
	}

	getQuadrant(x: number, y: number): number {
		const quadrantMap: Record<string, number> = {
			"--": 1,
			"+-": 2,
			"-+": 3,
			"++": 4,
		};

		const key = `${x >= 0 ? "+" : "-"}${y >= 0 ? "+" : "-"}`;
		return quadrantMap[key];
	}
}

export class NoteSorterBasesView extends BasesView {
	readonly type = NoteSorterViewType;
	private containerEl: HTMLElement;

	constructor(controller: QueryController, parentEl: HTMLElement) {
		super(controller);
		this.containerEl = parentEl.createDiv('bases-example-view-container');
	}

	public async onDataUpdated(): Promise<void> {
		// console.log("NoteSorterBasesView::onDataUpdated() called");
		// console.log(this.data);

		console.log("TargetCanvas from config:", this.config.get('TargetCanvas'));
		// If the user hasn't set a TargetCanvas to an extant file, pick the "first" active canvas file and save it as the config
		let canvasFile: TFile | null = this.config.get('TargetCanvas') ? this.app.vault.getFileByPath(this.config.get('TargetCanvas') as string) : null;
		if (!canvasFile) {
			this.app.workspace.iterateRootLeaves((leaf) => {
				if (!canvasFile && leaf.getViewState().type === 'canvas') {
					// @ts-ignore - not sure why view.file is not recognized
					canvasFile = leaf.view.file as TFile;
					this.config.set('TargetCanvas', canvasFile.path);
				}
			});
		}

		if (!canvasFile) {
			this.containerEl.setText('No canvas file found. Please open a canvas file to use with this view.');
			return;
		}

		await this.updateCanvas(canvasFile, this.data);
		this.containerEl.setText(`Canvas synced: ${canvasFile.path}`);
	}

	private async updateCanvas(canvasFile: TFile, queryResult: BasesQueryResult ): Promise<void> {
		let canvasData: CanvasData = { nodes: [], connections: [], edges: [] };
		try {
			const canvasContent = await this.app.vault.read(canvasFile);
			canvasData = JSON.parse(canvasContent);
		}
		catch (e) {
			// If the file doesn't exist or can't be read, start with an empty canvas
		}

		// Add the items in queryResult.data that are not in canvasData
		queryResult.data.filter(baseItem => {
			return !canvasData.nodes.some(node => (node.type === 'file' && (node as CanvasFileData).file === baseItem.file.path));
		}).forEach((baseItem, index) => {
			const newNode = this.createCanvasNodeForFile(baseItem.file, 100 * index, 100 * index);
			canvasData.nodes.push(newNode);
		});	

		// Remove the items in canvasData that are not in queryResult
		canvasData.nodes = canvasData.nodes.filter(node => {
			if (node.type === 'file') {
				return queryResult.data.some(baseItem => baseItem.file.path === (node as CanvasFileData).file);
			}
			return true;
		});

		// Write back the updated canvas data
		await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
	}

	private createCanvasNodeForFile(file: TFile, x: number, y: number): CanvasFileData {
		return {
			id: `${file.name}-${moment().format("YYYYMMDD[T]HHmmss")}`,
			type: 'file',
			file: file.path,
			x: x,
			y: y,
			height: 400,
			width: 400
		};
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: NoteSorterPlugin;

	constructor(app: App, plugin: NoteSorterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

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

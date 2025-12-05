import {
	Plugin,
} from 'obsidian';
import { 
	CanvasData, 
	CanvasFileData,
	CanvasNodeData } from 'obsidian/canvas';
import { 
	NoteSorterPluginSettings,
	DEFAULT_SETTINGS,
	NoteSorterViewType } from './src/types';
import { NoteSorterBasesView } from './src/views/NoteSorterBasesView';
import { getSortData } from './src/utils/sortUtils';

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

		const sortData = getSortData(targetNodes, centerNode);
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
}

import { BasesView, BasesQueryResult, QueryController, TFile, moment, BasesEntry } from 'obsidian';
import { CanvasData, CanvasFileData } from 'obsidian/canvas';
import { NoteSorterViewType } from '../types';

/**
 * BasesView for Note Sorter that syncs query results with canvas files
 */
export class NoteSorterBasesView extends BasesView {
	readonly type = NoteSorterViewType;
	private containerEl: HTMLElement;

	constructor(controller: QueryController, parentEl: HTMLElement) {
		super(controller);
		this.containerEl = parentEl.createDiv('bases-example-view-container');
	}

	public async onDataUpdated(): Promise<void> {
		// console.log("TargetCanvas from config:", this.config.get('TargetCanvas'), this);

		// Ideally, find the directory of the "project" managing the query. This is approximated by finding the most common parent directory of the files in the query result.
		const mostCommon = (files: BasesEntry[]) : string =>
			Object.entries(files.reduce((a,f)=>{const p=f.file.parent?.path;if(p)a[p]=(a[p]||0)+1;return a;},{} as Record<string,number>))
					.sort((a,b)=>b[1]-a[1])[0]?.[0] ?? null;

		const mostCommonDir = mostCommon(this.data.data);
		console.log("Most common directory:", mostCommonDir);

		// Obsidian paths should not start with a slash
		const getDirPrefix = (path: string) : string => {
			if (!path || path.length === 0 || path === '/') return '';

			return path + '/';
		}

		// @ts-ignore - ignore missing this.config.query property
		const fileName = `${this.config.query.file.basename}-${this.config.name}.canvas`;
		const canvasFilePath = `${getDirPrefix(mostCommonDir)}${fileName}`;
		console.log("Derived canvas file path:", canvasFilePath);
		const canvasFile = await this.createOrGetFileByPath(canvasFilePath);

		await this.updateCanvas(canvasFile, this.data);
		this.containerEl.setText(`Canvas synced: ${canvasFile.path}`);
	}

	private async createOrGetFileByPath(filePath: string): Promise<TFile> {
		if (!filePath || filePath.length === 0) {
			throw new Error("Empty file path");
		}

		if (filePath.startsWith('/')) {
			throw new Error("Obsidian File path should not start with a slash");
		}

		let file = this.app.vault.getFileByPath(filePath);
		if (null == file) {
			file = await this.app.vault.create(filePath, '');
		}

		return file;
	}

	private async updateCanvas(canvasFile: TFile, queryResult: BasesQueryResult): Promise<void> {
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

		console.log("Updating canvas:", canvasFile.name);

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

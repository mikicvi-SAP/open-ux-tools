import type { ExternalAction, SavedPropertyChange, PendingPropertyChange, UnknownSavedChange } from '../../../api';
import { changeProperty, changeStackModified, deletePropertyChanges, propertyChangeFailed } from '../../../api';
import { applyChange } from './flexChange';
import type { SelectionService } from '../selection';

import type { ActionSenderFunction, SubscribeFunction, UI5AdaptationOptions, UI5Facade } from '../types';

/**
 * A Class of ChangeService
 */
export class ChangeService {
    private savedChanges: SavedPropertyChange[] = [];
    /**
     *
     * @param options
     * @param ui5
     * @param selectionService
     */
    constructor(
        private readonly options: UI5AdaptationOptions,
        private readonly ui5: UI5Facade,
        private readonly selectionService: SelectionService
    ) {}

    /**
     *
     * @param sendAction
     * @param subscribe
     */
    public async init(sendAction: ActionSenderFunction, subscribe: SubscribeFunction): Promise<void> {
        subscribe(async (action): Promise<void> => {
            if (changeProperty.match(action)) {
                try {
                    this.selectionService.applyControlPropertyChange(
                        action.payload.controlId,
                        action.payload.propertyName
                    );
                    await applyChange(this.options, action.payload);
                } catch (exception) {
                    // send error information
                    let name = '';
                    const id = action.payload['controlId'] || '';
                    const control = this.ui5.getControlById(id);
                    if (control) {
                        name = control.getMetadata().getName();
                    }
                    const modifiedMessage = modifyRTAErrorMessage(exception?.toString(), id, name);
                    const errorMessage =
                        modifiedMessage || `RTA Exception applying expression "${action.payload.value}"`;
                    const propertyChangeFailedAction = propertyChangeFailed({ ...action.payload, errorMessage });
                    sendAction(propertyChangeFailedAction);
                }
            } else if (deletePropertyChanges.match(action)) {
                await this.deleteChange(action.payload.controlId, action.payload.propertyName, action.payload.fileName);
            }
        });

        const savedChanges = await fetch(`/FioriTools/api/getChanges?_=${Date.now()}`)
            .then((response) => response.json())
            .catch(console.error);
        const changes = (
            Object.keys(savedChanges ?? {})
                .map((key): SavedPropertyChange | UnknownSavedChange | undefined => {
                    const change = savedChanges[key];
                    try {
                        assertChange(['fileName', 'selector.id', 'content.property', 'creation'], change);
                        if (
                            [change.content.newValue, change.content.newBinding].every(
                                (item) => item === undefined || item === null
                            )
                        ) {
                            throw new Error(`Invalid change, missing new value in the change file`);
                        }
                        return {
                            type: 'saved',
                            kind: 'valid',
                            fileName: change.fileName,
                            controlId: change.selector.id,
                            propertyName: change.content.property,
                            value: change.content.newValue ?? change.content.newBinding,
                            timestamp: new Date(change.creation).getTime(),
                            controlName: change.selector.type.split('.').pop()
                        };
                    } catch (error) {
                        // Gracefully handle change files with invalid content
                        if (change.fileName) {
                            const unknownChange: UnknownSavedChange = {
                                type: 'saved',
                                kind: 'unknown',
                                fileName: change.fileName
                            };
                            if (change.creation) {
                                unknownChange.timestamp = new Date(change.creation).getTime();
                            }
                            return unknownChange;
                        }
                        console.error(error);
                        return undefined;
                    }
                })
                .filter((change) => !!change) as SavedPropertyChange[]
        ).sort((a, b) => b.timestamp - a.timestamp);
        this.savedChanges = changes;
        sendAction(
            changeStackModified({
                saved: changes,
                pending: []
            })
        );
        this.options.rta.attachUndoRedoStackModified(this.createOnStackChangeHandler(sendAction));
    }

    /**
     *
     * @param controlId
     * @param propertyName
     * @param fileName
     */
    public async deleteChange(controlId: string, propertyName: string, fileName?: string): Promise<void> {
        const filesToDelete = this.savedChanges
            .filter((change) =>
                fileName
                    ? fileName === change.fileName
                    : change.controlId === controlId && change.propertyName === propertyName
            )
            .map((change) =>
                fetch(`/FioriTools/api/removeChanges`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ fileName: change.fileName })
                })
            );

        await Promise.all(filesToDelete).catch(console.error);
    }

    /**
     * Handler for undo/redo stack change.
     *
     * @param sendAction
     * @returns {(event: sap.ui.base.Event) => Promise<void>}
     */
    private createOnStackChangeHandler(
        sendAction: (action: ExternalAction) => void
    ): (event: sap.ui.base.Event) => Promise<void> {
        return async (): Promise<void> => {
            const stack = this.options.rta.getCommandStack();
            const allCommands = stack.getCommands();
            const executedCommands = stack.getAllExecutedCommands();
            const inactiveCommandCount = allCommands.length - executedCommands.length;

            const activeChanges = allCommands
                .map((command: sap.ui.rta.command.BaseCommand, i): PendingPropertyChange | undefined => {
                    let result: PendingPropertyChange | undefined;
                    try {
                        const selector = command.getProperty('selector');
                        const changeType = command.getProperty('changeType');
                        let value = '';
                        switch (changeType) {
                            case 'propertyChange':
                                value = command.getProperty('newValue');
                                break;
                            case 'propertyBindingChange':
                                value = command.getProperty('newBinding');
                                break;
                            default:
                                throw new Error(`Invalid changeType ${changeType}`);
                        }
                        result = {
                            type: 'pending',
                            controlId: selector.id,
                            propertyName: command.getProperty('propertyName'),
                            isActive: i >= inactiveCommandCount,
                            value,
                            controlName: command.getElement().getMetadata().getName().split('.').pop() ?? ''
                        };
                    } catch (error) {
                        console.error(error);
                    }
                    return result;
                })
                .filter((change): boolean => !!change) as PendingPropertyChange[];
            sendAction(
                changeStackModified({
                    saved: this.savedChanges,
                    pending: activeChanges
                })
            );
        };
    }
}

/**
 * Modify rta message.
 *
 * @param errorMessage
 * @param id
 * @param type
 * @returns {string}
 */
function modifyRTAErrorMessage(errorMessage: string, id: string, type: string): string {
    return errorMessage.replace('Error: Applying property changes failed:', '').replace(`${type}#${id}`, '');
}

/**
 * Assert change for its validity. Throws error if no value found in saved changes.
 *
 * @param properties
 * @param target
 */
function assertChange(properties: string[], target: any): void {
    for (const property of properties) {
        const value = getValue(property, target);
        if (value === null || value === undefined) {
            throw new Error(`Invalid change, missing ${property} in the change file`);
        }
    }
}

/**
 * Look up property values in object (including nested).
 *
 * @param property Path to property using "." to separate nested structures
 * @param object
 * @returns
 */
function getValue(property: string, object: any): any {
    const segments = property.split('.');
    let current = object;
    for (const segment of segments) {
        current = current[segment];
    }
    return current;
}

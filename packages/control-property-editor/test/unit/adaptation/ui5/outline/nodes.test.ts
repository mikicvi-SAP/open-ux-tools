import { transformNodes as tn } from '../../../../../src/adaptation/ui5/outline/nodes';
import type { OutlineNode } from '../../../../../src/api';

jest.mock('../../../../../src/adaptation/ui5/outline/utils', () => {
    return {
        isEditable: () => false
    };
});
describe('outline nodes', () => {
    const transformNodes = (nodes: sap.ui.rta.OutlineViewNode[]): Promise<OutlineNode[]> => tn(nodes, () => ({}));
    describe('transformNodes', () => {
        test('empty tree', async () => {
            expect(await transformNodes([])).toStrictEqual([]);
        });

        test('single element', async () => {
            expect(
                await transformNodes([
                    {
                        id: 'application-preview-app-component',
                        technicalName: 'v2flex.Component',
                        editable: false,
                        type: 'element',
                        visible: true
                    }
                ])
            ).toStrictEqual([
                {
                    children: [],
                    controlId: 'application-preview-app-component',
                    controlType: 'v2flex.Component',
                    editable: false,
                    name: 'Component',
                    visible: true
                }
            ]);
        });

        test('aggregation', async () => {
            expect(
                await transformNodes([
                    {
                        id: 'application-preview-app-component',
                        technicalName: 'v2flex.Component',
                        editable: false,
                        type: 'element',
                        visible: true,
                        elements: [
                            {
                                id: 'application-preview-app-component',
                                technicalName: 'rootControl',
                                editable: false,
                                type: 'aggregation',
                                elements: [
                                    {
                                        id: '__layout0',
                                        technicalName: 'sap.f.FlexibleColumnLayout',
                                        editable: false,
                                        type: 'element',
                                        visible: true
                                    }
                                ]
                            }
                        ]
                    }
                ])
            ).toStrictEqual([
                {
                    controlId: 'application-preview-app-component',
                    controlType: 'v2flex.Component',
                    editable: false,
                    name: 'Component',
                    visible: true,
                    children: [
                        {
                            controlId: '__layout0',
                            controlType: 'sap.f.FlexibleColumnLayout',
                            name: 'FlexibleColumnLayout',
                            editable: false,
                            visible: true,
                            children: []
                        }
                    ]
                }
            ]);
        });
    });
});
